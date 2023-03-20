// -*- mode: java; c-basic-offset: 2; -*-
// Copyright 2013-2014 MIT, All rights reserved
// Released under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
/**
 * @license
 * @fileoverview Visual blocks editor for App Inventor
 * FieldCodeEditor is a subclass of FieldTextInput
 *
 * @author mckinney@mit.edu (Andrew F. McKinney)
 */

'use strict';

goog.provide('Blockly.FieldCodeEditor');
goog.require('goog.events.KeyCodes');

Blockly.FieldCodeEditor = function (text, opt_validator) {
  // Call parent's constructor.
  Blockly.FieldCodeEditor.superClass_.constructor.call(this, text, opt_validator);
};

// FieldCodeEditor is a subclass of FieldTextInput.
goog.inherits(Blockly.FieldCodeEditor, Blockly.FieldTextInput);

Blockly.FieldCodeEditor.FONTSIZE = 11;

Blockly.FieldCodeEditor.prototype.maxLines_ = Infinity;

Blockly.FieldCodeEditor.prototype.isOverflowedY_ = false;

Blockly.FieldCodeEditor.prototype.toXml = function (fieldElement) {
  fieldElement.textContent = (this.getValue()).replace(/\n/g, '&#10;');
  return fieldElement;
};

Blockly.FieldCodeEditor.prototype.fromXml = function (fieldElement) {
  this.setValue(fieldElement.textContent.replace(/&#10;/g, '\n'));
};

Blockly.FieldCodeEditor.prototype.init = function () {
  this.workspace_ = this.sourceBlock_.workspace;
  if (this.fieldGroup_) {
    // Field has already been initialized once.
    return;
  }
  this.fieldGroup_ = Blockly.utils.createSvgElement('g', {}, null);
  if (!this.visible_) {
    this.fieldGroup_.style.display = 'none';
  }
  this.sourceBlock_.getSvgRoot().appendChild(this.fieldGroup_);
  this.initView_();
  this.updateEditable();
  this.mouseUpWrapper_ = Blockly.bindEventWithChecks_(this.fieldGroup_, 'mouseup', this, this.onMouseUp_);
};

Blockly.FieldCodeEditor.prototype.initView_ = function () {
  this.createBorderRect_();
  this.createTextElement_();
  this.textGroup_ = Blockly.utils.createSvgElement('g', {'class': 'blocklyEditableText'}, this.fieldGroup_);
}

Blockly.FieldCodeEditor.prototype.createTextElement_ = function () {
  this.textElement_ = Blockly.utils.createSvgElement('text', {
    'class': 'blocklyText',
    'y': this.size_.height - 12.5
  }, this.fieldGroup_);
  this.textContent_ = document.createTextNode('');
  this.textElement_.appendChild(this.textContent_);
}

Blockly.FieldCodeEditor.prototype.createBorderRect_ = function () {
  this.borderRect_ = Blockly.utils.createSvgElement('rect', {
      'rx': Blockly.BlockSvg.CORNER_RADIUS / 2,
      'ry': Blockly.BlockSvg.CORNER_RADIUS / 2,
      'x': -Blockly.BlockSvg.SEP_SPACE_X / 2,
      'y': 0,
      'height': this.size_.height,
      'class': 'blocklyFieldRect'
    },
    this.fieldGroup_,
    this.sourceBlock_.workspace);
}

Blockly.FieldCodeEditor.prototype.getDisplayText_ = function () {
  var thisField = this;
  var block = thisField.sourceBlock_;
  if (!block) {
    throw new Error("Unattached field!");
  }

  var textLines = thisField.getText();
  if (!textLines) {
    return Blockly.Field.NBSP;
  }
  var lines = textLines.split('\n');
  textLines = '';
  var displayLinesNumber = this.isOverflowedY_ ? this.maxLines_ : lines.length;
  for (var i = 0; i < displayLinesNumber; i++) {
    var text = lines[i];
    if (text.length > this.maxDisplayLength) {
      // Truncate displayed string and add an ellipsis ('...').
      text = text.substring(0, this.maxDisplayLength - 4) + '...';
    } else if (this.isOverflowedY_ && i === displayLinesNumber - 1) {
      text = text.substring(0, text.length - 3) + '...';
    }

    // Replace whitespace with non-breaking spaces so the text doesn't collapse.
    text = text.replace(/\s/g, Blockly.Field.NBSP);
    textLines += text;
    if (i !== displayLinesNumber - 1) {
      textLines += '\n';
    }
  }
  if (block.RTL) {
    // The SVG is LTR, force value to be RTL.
    textLines += '\u200F';
  }
  return textLines;
}

Blockly.FieldCodeEditor.prototype.onHtmlInputKeyDown_ = function (e) {
  if (e.keyCode !== goog.events.KeyCodes.ENTER) {
    Blockly.FieldTextInput.prototype.onHtmlInputKeyDown_.call(this, e);
  }
};

Blockly.FieldCodeEditor.prototype.render_ = function () {
  var block = this.sourceBlock_;
  if (!block) {
    new Error("No source block found! I don't think this should happen....");
  }
  if (!this.visible_) {
    this.size_.width = 0;
    return;
  }

  var currentChild;
  while (currentChild = this.textGroup_.firstChild) {
    this.textGroup_.removeChild(currentChild);
  }

  // Add in text elements into the group.
  var lines = this.getDisplayText_().split('\n');
  var y = 0;
  var fieldTextHeight = 12.5;
  var baseline = 12;
  for (var i = 0; i < lines.length; i++) {
    var span = Blockly.utils.createSvgElement('text', {
      'class': 'blocklyText blocklyMultilineText',
      'y': y,
      'dy': baseline
    }, this.textGroup_);
    span.appendChild(document.createTextNode(lines[i]));
    y += fieldTextHeight;
  }

  if (this.isBeingEdited_) {
    var htmlInput = this.htmlInput_;
    if (this.isOverflowedY_) {
      Blockly.utils.addClass(htmlInput, 'blocklyHtmlTextAreaInputOverflowedY');
    } else {
      Blockly.utils.removeClass(htmlInput, 'blocklyHtmlTextAreaInputOverflowedY');
    }
  }

  this.updateSize_();

  if (this.isBeingEdited_) {
    if (block.RTL) {
      // in RTL, we need to let the browser reflow before resizing
      // in order to get the correct bounding box of the borderRect
      // avoiding issue #2777.
      setTimeout(this.resizeEditor_.bind(this), 0);
    } else {
      this.resizeEditor_();
    }
    var htmlInput = this.htmlInput_;
    if (!this.isTextValid_) {
      Blockly.utils.addClass(htmlInput, 'blocklyInvalidInput');
      aria.setState(htmlInput, aria.State.INVALID, true);
    } else {
      Blockly.utils.removeClass(htmlInput, 'blocklyInvalidInput');
      aria.setState(htmlInput, aria.State.INVALID, false);
    }
  }
};

Blockly.FieldCodeEditor.prototype.updateSize_ = function () {
  var nodes = this.textGroup_.childNodes;
  var totalWidth = 0;
  var totalHeight = 0;
  for (var i = 0; i < nodes.length; i++) {
    var tspan = nodes[i];
    var textWidth = Blockly.Field.getCachedWidth(tspan);
    if (textWidth > totalWidth) {
      totalWidth = textWidth;
    }
    totalHeight += 12.5 + (i > 0 ? .5 : 0);
  }
  if (this.isBeingEdited_) {
    var actualEditorLines = this.value_.split('\n');
    var dummyTextElement = Blockly.utils.createSvgElement(
      'text',
      {'class': 'blocklyText blocklyMultilineText'}
    );
    for (var j = 0; j < actualEditorLines.length; j++) {
      if (actualEditorLines[j].length > this.maxDisplayLength) {
        actualEditorLines[j] =
          actualEditorLines[j].substring(0, this.maxDisplayLength);
      }
      dummyTextElement.textContent = actualEditorLines[j];
      var lineWidth = Blockly.Field.getCachedWidth(dummyTextElement);
      if (lineWidth > totalWidth) {
        totalWidth = lineWidth;
      }
    }
    var scrollbarWidth = this.htmlInput_.offsetWidth - this.htmlInput_.clientWidth;
    totalWidth += scrollbarWidth;
  }

  if (this.borderRect_) {
    this.borderRect_.setAttribute('width', totalWidth + Blockly.BlockSvg.SEP_SPACE_X);
    this.borderRect_.setAttribute('height', totalHeight);
  }
  this.size_.width = totalWidth;
  this.size_.height = totalHeight;
}

Blockly.FieldCodeEditor.prototype.showEditor_ = function (_opt_e) { // TODO: handle "quietInput"
  this.createWidget_();
  this.render_();
};

Blockly.FieldCodeEditor.prototype.createWidget_ = function () {
  Blockly.WidgetDiv.show(this, this.sourceBlock_.RTL, this.widgetDispose_);
  var div = Blockly.WidgetDiv.DIV;
  var scale = this.workspace_.scale;

  var htmlInput = document.createElement('textarea');
  htmlInput.className = 'blocklyHtmlInput blocklyHtmlTextAreaInput';
  var fontSize = (Blockly.FieldCodeEditor.FONTSIZE * this.workspace_.scale) + 'pt';
  htmlInput.style.fontSize = fontSize;
  var borderRadius = 4 * scale + 'px';
  htmlInput.style.borderRadius = borderRadius;
  var lineHeight = 12.5;
  htmlInput.style.lineHeight = lineHeight * scale + 'px';
  div.appendChild(htmlInput);
  htmlInput.value = htmlInput.defaultValue = this.text_;
  htmlInput.oldValue_ = null;
  htmlInput.setAttribute('data-untyped-default-value', this.value_);
  htmlInput.setAttribute('data-old-value', '');
  var editor = window.CodeMirror.fromTextArea(htmlInput, {
    mode: "venbrace",
    lineNumbers: true,
    autoCloseBrackets: true,
    scanForBracket: true,
    matchBrackets: true,
    cursorBlinkRate: 0
  });
  this.resizeEditor_();
  var thisField = this;
  editor.on('change', function () {
    thisField.setValue(editor.getValue());
  });
  editor.on('refresh', function () {
  });
  editor.on('blur', function () {
    editor.save();
    editor.toTextArea();
  });
  editor.focus();
  return htmlInput;
};
