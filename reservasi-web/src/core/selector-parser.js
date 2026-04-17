"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectorParser = void 0;
var selector_css_1 = require("./selector-css");
var SelectorParser = /** @class */ (function () {
    function SelectorParser() {
    }
    SelectorParser.parse = function (selector) {
        var trimmed = selector.trim();
        if (trimmed.length == 0) {
            throw new Error("SelectorParser: Selecter kosong");
        }
        var tokens = selector_css_1.SelectorLexer.tokenize(trimmed);
        if (tokens.length === 0) {
            throw new Error("SelectorPaser: Hasil dari tokenize SelectorLexer kosong");
        }
        return {
            steps: this.buildSteps(tokens),
            before: trimmed,
        };
    };
    SelectorParser.buildSteps = function (tokens) {
        var steps = [];
        var curCombinator = null;
        var buffer = [];
        for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
            var token = tokens_1[_i];
            if (token.type === "combinator") {
                if (buffer.length === 0) {
                    throw new Error("SelectorParser: Setelag combinator tidak ada simple selector");
                }
                steps.push({ combinator: curCombinator, selector: this.buildSimpleSelector(buffer), });
                buffer = [];
                curCombinator = token.type;
            }
            else {
                buffer.push(token);
            }
        }
        if (buffer.length === 0) {
            throw new Error("SelectorParser: Selector tidak boleh diakhir dengan combinator.");
        }
        steps.push({ combinator: curCombinator, selector: this.buildSimpleSelector(buffer) });
        return steps;
    };
    SelectorParser.buildSimpleSelector = function (buffer) {
        var tag = null;
        var id = null;
        var classes = [];
        var universal = false;
        for (var _i = 0, buffer_1 = buffer; _i < buffer_1.length; _i++) {
            var token = buffer_1[_i];
            switch (token.type) {
                case "tag":
                    if (tag != null) {
                        throw new Error("SelectorParser: Tidak boleh ada 2 tag selector (".concat(tag, " dan ").concat(token.value, ")"));
                    }
                    tag = token.value;
                    break;
                case "id":
                    if (id != null) {
                        throw new Error("SelectorParser: Tidak boleh ada 2 id selector (".concat(id, " dan ").concat(token.value, ")"));
                    }
                    id = token.value;
                    break;
                case "class":
                    classes.push(token.value);
                    break;
                case "universal":
                    universal = true;
                    break;
                default:
                    throw new Error("SelectorParser: Token dengan tipe ".concat(token.type, " tidak valid."));
            }
        }
        return { tag: tag, id: id, classes: classes, universal: universal };
    };
    return SelectorParser;
}());
exports.SelectorParser = SelectorParser;
