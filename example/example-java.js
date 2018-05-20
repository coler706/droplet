/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const readFile = function(name) {
  const q = new XMLHttpRequest();
  q.open('GET', name, false);
  q.send();
  return q.responseText;
};

require.config({
  baseUrl: '../js',
  paths: JSON.parse(readFile('../requirejs-paths.json'))
});

require(['droplet'], function(droplet) {

  // Example palette
  window.editor = new droplet.Editor(document.getElementById('editor'), {
    // JAVASCRIPT TESTING:
    mode: 'java',
    modeOptions: {
    },
    palette: [
    ]
  });

  editor.setEditorState(false);
  editor.aceEditor.getSession().setUseWrapMode(true);

  // Initialize to starting text
  const startingText = localStorage.getItem('example');
  editor.setValue(startingText || '');

  // Update textarea on ICE editor change
  const onChange = () => localStorage.setItem('example', editor.getValue());

  editor.on('change', onChange);

  editor.aceEditor.on('change', onChange);

  // Trigger immediately
  onChange();

  editor.clearUndoStack();

  const messageElement = document.getElementById('message');
  const displayMessage = function(text) {
    messageElement.style.display = 'inline';
    messageElement.innerText = text;
    return setTimeout((() => messageElement.style.display = 'none'), 2000);
  };

  return document.getElementById('toggle').addEventListener('click', function() {
    editor.toggleBlocks();
    if ($('#palette_dialog').dialog('isOpen')) {
      return $('#palette_dialog').dialog('close');
    } else {
      return $("#palette_dialog").dialog('open');
    }
  });
});
