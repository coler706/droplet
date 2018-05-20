/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Droplet config editor
if (!window.ALREADY_LOADED) {
  let left;
  window.ALREADY_LOADED = true;
  const dropletConfig = ace.edit('droplet-config');
  dropletConfig.setTheme('ace/theme/chrome');
  dropletConfig.getSession().setMode('ace/mode/javascript');


  dropletConfig.setValue((left = localStorage.getItem('config')) != null ? left : `\
({
  "mode": "javascript",
  "modeOptions": {
    "functions": {
      "playSomething": { "command": true, "color": "red"},
      "bk": { "command": true, "color": "blue"},
      "sin": { "command": false, "value": true, "color": "green" }
    },
    "categories": {
      "conditionals": { "color": "purple" },
      "loops": { "color": "green" },
      "functions": { "color": "#49e" }
    }
  },

  "palette": [
   {
      "name": "Palette category",
      "color": "blue",
      "blocks": [
        {
          "block": "for(var i=0;i<10;i++){\n\n}",
          "title": "Repeat some code"
        },
        {
          "block": "playSomething()",
          "expansion": "playSomething 'arguments', 100, 'too long to show'"
        }
      ]
    }
  ]
})\
`
  );

  let editor = null;

// Droplet itself
//<<<<<<< HEAD
  const createEditor = function(options) {
    let left1;
    $('#droplet-editor').html('');
    editor = new droplet.Editor($('#droplet-editor')[0], options);
//=======
//createEditor = (options) ->
//  $('#droplet-editor').html '<div id="ace-target"></div>'
//  aceEditor = ace.edit 'ace-target'
//  editor = new droplet.Editor aceEditor, options
//>>>>>>> c_support

    editor.setEditorState(localStorage.getItem('blocks') === 'yes');
    editor.aceEditor.getSession().setUseWrapMode(true);
    editor.aceEditor.setOptions({
  fontFamily: "pixelFont",
  fontSize: "16px"
});

    // Initialize to starting text
    editor.setValue((left1 = localStorage.getItem('text')) != null ? left1 : '');

    editor.on('change', () => localStorage.setItem('text', editor.getValue()));

    return window.editor = editor;
  };

  createEditor(eval(dropletConfig.getValue()));

  $('#toggle').on('click', function() {
    editor.toggleBlocks();
    return localStorage.setItem('blocks', (editor.currentlyUsingBlocks ? 'yes' : 'no'));
  });

  // Stuff for testing convenience
  $('#update').on('click', function() {
    localStorage.setItem('config', dropletConfig.getValue());
    return createEditor(eval(dropletConfig.getValue()));
  });

  let configCurrentlyOut = localStorage.getItem('configOut') === 'yes';

  const updateConfigDrawerState = function() {
    if (configCurrentlyOut) {
      $('#left-panel').css('left', '0px');
      $('#right-panel').css('left', '525px');
    } else {
      $('#left-panel').css('left', '-500px');
      $('#right-panel').css('left', '25px');
    }

    editor.resize();

    return localStorage.setItem('configOut', (configCurrentlyOut ? 'yes' : 'no'));
  };

  $('#close').on('click', function() {
    configCurrentlyOut = !configCurrentlyOut;
    return updateConfigDrawerState();
  });

  updateConfigDrawerState();
}
