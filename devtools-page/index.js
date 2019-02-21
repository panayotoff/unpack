//http://qaru.site/questions/7842022/chromedownloadsdownload-api-saveas-dialogue-is-flashing-on-the-screen-and-then-closes-before-i-see-the-dialogue

// Reloads page
document.querySelector('#reload-page').addEventListener('click', () => {
  chrome.tabs.reload(chrome.devtools.inspectedWindow.tabId, null, () => {});
});

// Fetch all resources
document.querySelector('#fetch').addEventListener('click', async () => {
  const webpackResources = await getWindowWebpackResources();
  const resourcesTree = flatToTree(webpackResources.src);
  const fileExplorerDom = treeToDom(resourcesTree);
  document.querySelector('#file-explorer').innerHTML = fileExplorerDom;
  document.querySelector('#file-explorer').addEventListener('click', async event => {
    if (event.target.matches('.file')) {
      const filePath = event.target.getAttribute('data-file');
      const file = webpackResources.src.find(r => r.path === filePath);
      const fileContent = await file.content;
    }
  });
});

// Download all resources
document.querySelector('#download-all').addEventListener('click', () => {
  chrome.devtools.inspectedWindow.getResources(async resources => {
    const webpackResources = await getWindowWebpackResources();

    if (JSZip) {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
        const tab = tabs[0];
        const domain = tab.url.split('://')[1].substring(0, tab.url.split('://')[1].indexOf('/'));
        const zip = new JSZip();

        let node_modules_file_contents = '';
        webpackResources.node_modules.forEach(module => (node_modules_file_contents += `${module}\n`));

        zip.folder(domain).file('node_modules.md', node_modules_file_contents);
        webpackResources.src.forEach(resource => {
          zip.file(`${domain}/src/${resource.path}`, resource.content);
        });

        zip.generateAsync({ type: 'blob' }).then(content => {
          downloadZip(content, `${domain}.zip`);
        });
      });
    }
  });
});

/**
 *
 * @param {Blob} content
 * @param {String} filename
 */
function downloadZip(content, filename) {
  const url = URL.createObjectURL(content);
  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: false
  });
}

/**
 *  All Webpack resources from current window
 */
function getWindowWebpackResources() {
  return new Promise(resolve => {
    chrome.devtools.inspectedWindow.getResources(windowResources => {
      const webpackResources = windowResources.filter(resource => resource.url.startsWith('webpack://'));

      const resources = {
        node_modules: new Set(),
        src: []
      };

      webpackResources.forEach((resource, index) => {
        if (resource.url.includes('node_modules')) {
          const module_name = resource.url.split('node_modules/')[1].split('/')[0]; // TODO: @vue/ ; @babel/
          resources.node_modules.add(module_name);
        } else {
          const path = normalizePath(resource.url);
          const content = getContent(resource);

          if (path) {
            resources.src.push({
              path,
              content
            });
          }
        }
      });

      // Wait for all resouces to be loaded....
      Promise.all(resources.src.map(s => s.content)).then(() => {
        resolve(resources);
      });
    });
  });
}

/**
 * Async helper to get resource content
 * @param {ChomeResource} resource
 */
function getContent(resource) {
  return new Promise(resolve => {
    resource.getContent(content => {
      resolve(content);
    });
  });
}

/**
 * Normalize webpack://url to what supposed to be original filesystem path
 * @param {Url} path
 */
function normalizePath(path) {
  if (path.includes('src/')) {
    return path.split('src/')[1];
  }
  if (path.startsWith('webpack:///.')) {
    return path.split('webpack:///.')[1];
  }

  if (path.startsWith('webpack:///./src')) {
    return path.split('webpack:///./src')[1];
  }

  if (path.startsWith('webpack:///./')) {
    return path.split('webpack:///./')[1];
  }
}

// Helpers
const flatToTree = data => {
  const tree = { name: 'Webpack', type: 'folder', nodes: [] };
  data.forEach(file => {
    const segments = file.path.split('/');
    let path = tree;
    while (segments.length) {
      const segment = segments.shift();
      if (segments.length === 0) {
        path.nodes.push({ type: 'file', name: segment, file: file.path });
      } else {
        let newPath = path.nodes.find(node => node.name === segment);
        if (!newPath) {
          newPath = { name: segment, type: 'folder', nodes: [] };
          path.nodes.push(newPath);
        }
        path = newPath;
      }
    }
  });
  return tree;
};

/**
 * Tree data to dom
 * @param {*} data
 */
const treeToDom = data => {
  let uniqid = 0;

  function nodeMarkup(node) {
    if (node.nodes) {
      let str = `<li class="folder">
        <input id="f${uniqid}" type="checkbox" />
        <label for="f${uniqid}"><span>${node.name}</span></label>
        <ul class="folder-content">`;
      node.nodes.forEach(n => {
        uniqid++;
        str += nodeMarkup(n, str);
      });
      str += `</ul></li>`;
      return str;
    }

    // Single node
    return `<li class="file" data-file="${node.file}">${node.name}</li>`;
  }

  return `<ul class="root">${nodeMarkup(data)}</ul>`;
};
