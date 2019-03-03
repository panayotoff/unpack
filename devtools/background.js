const onMessageListener = function(message, sender, sendResponse) {
  switch (message.type) {
    case 'log':
      console.log(...message.args);
      break;
  }
  return true;
};
chrome.runtime.onMessage.addListener(onMessageListener);
