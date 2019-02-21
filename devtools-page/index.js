//http://qaru.site/questions/7842022/chromedownloadsdownload-api-saveas-dialogue-is-flashing-on-the-screen-and-then-closes-before-i-see-the-dialogue

// document.querySelector('#fetch-all').addEventListener('click', () => {
//   chrome.devtools.inspectedWindow.getResources(resources => {
//     const webpackResources = resources.filter(resource => resource.url.startsWith('webpack://'));
//     processWebpackResources(webpackResources);
//   });
// });

document.querySelector('#reload-page').addEventListener('click', () => {
  chrome.tabs.reload(chrome.devtools.inspectedWindow.tabId, null, () => {});
});

document.querySelector('#download-all').addEventListener('click', () => {
  chrome.devtools.inspectedWindow.getResources(async resources => {
    const webpackResources = resources.filter(resource => resource.url.startsWith('webpack://'));
    const resourcesMap = await getResourcesMap(webpackResources);

    if (JSZip) {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
        const tab = tabs[0];
        const domain = tab.url.split('://')[1].substring(0, tab.url.split('://')[1].indexOf('/'));
        const zip = new JSZip();

        let node_modules_file_contents = '';
        resourcesMap.node_modules.forEach(module => (node_modules_file_contents += `${module}\n`));

        zip.folder(domain).file('node_modules.md', node_modules_file_contents);
        resourcesMap.src.forEach(resource => {
          zip.file(`${domain}/src/${resource.path}`, resource.content);
        });

        zip.generateAsync({ type: 'blob' }).then(content => {
          downloadZip(content, `${domain}.zip`);
        });
      });
    }
  });
});

function downloadZip(content, filename) {
  // const dataURL = 'data:application/zip;base64,' + content;
  const url = URL.createObjectURL(content);
  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: false
  });
}

async function processWebpackResources(resources) {
  const resourcesMap = await getResourcesMap(resources);
  console.log('resouces map', resourcesMap);
}

// Builds map with all node_modules and resourxes
function getResourcesMap(resources) {
  const resourcesMap = {
    node_modules: new Set(),
    src: []
  };
  resources.forEach(async resource => {
    console.log(resource.url);

    if (resource.url.includes('node_modules')) {
      const module_name = resource.url.split('node_modules/')[1].split('/')[0];
      resourcesMap.node_modules.add(module_name);
    } else {
      let resource_path;
      if (resource.url.includes('src/')) {
        resource_path = resource.url.split('src/')[1];
      }
      if (resource.url.startsWith('webpack:///.')) {
        resource_path = resource.url.split('webpack:///.')[1];
      }

      const resource_content = await getContent(resource);
      const resource_dirname = resource_path.split('/');
      const resource_filename = resource_dirname.pop();
      resourcesMap.src.push({
        path: resource_path,
        dirname: resource_dirname,
        filename: resource_filename,
        content: resource_content
      });
    }
  });
  return resourcesMap;
}

// Helper - async getContent
function getContent(resource) {
  return new Promise((resolve, reject) => {
    resource.getContent(content => {
      resolve(content);
    });
  });
}
