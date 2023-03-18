'use strict';

goog.provide('Blockly.Blocks.code');

goog.require('Blockly.Blocks.Utilities');


Blockly.Blocks["code_decl"] = {
    category: "Code",
    init: function() {
        this.setColour(Blockly.CODE_CATEGORY_HUE);
        this.appendDummyInput()
          .appendField("code decl")
          .appendField(new Blockly.FieldCodeEditor(''), 'CODE');
    },
    typeblock: [{translatedName: "code declaration"}]
}

Blockly.Blocks["code_stmt"] = {
    category: "Code",
    init: function() {
        this.setColour(Blockly.CODE_CATEGORY_HUE);
        this.appendDummyInput()
          .appendField("code stmt")
          .appendField(new Blockly.FieldCodeEditor(''), 'CODE');
        this.setPreviousStatement(true);
        this.setNextStatement(true);
    },
    typeblock: [{translatedName: "code statement"}]
}

Blockly.Blocks["code_expr"] = {
    category: "Code",
    init: function() {
        this.setColour(Blockly.CODE_CATEGORY_HUE);
        this.appendDummyInput()
          .appendField("code expr")
          .appendField(new Blockly.FieldCodeEditor(''), 'CODE');
        this.setOutput(true, null);
    },
    typeblock: [{translatedName: "code expression"}]
}
