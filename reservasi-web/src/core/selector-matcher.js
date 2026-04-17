"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectorMatcher = void 0;
var selector_parser_1 = require("./selector-parser");
var traversal_1 = require("./traversal");
var SelectorMatcher = /** @class */ (function () {
    function SelectorMatcher() {
    }
    /*
    Mengecek apakah sebuah node tertentu cocok dengan selector yang sudah di-parse.
    Strategi: Matching dilakukan dari kanan ke kiri (seperti browser engine).
     */
    SelectorMatcher.matches = function (node, parsed) {
        var steps = parsed.steps;
        return this.matchStepRecursive(node, steps, steps.length - 1);
    };
    /*
    Mencari semua node di bawah root yang cocok dengan string selector.
     */
    SelectorMatcher.querySelectorAll = function (root, selector) {
        var _this = this;
        var parsed = selector_parser_1.SelectorParser.parse(selector);
        var results = [];
        traversal_1.TreeTraversal.dfs(root, function (node) {
            if (_this.matches(node, parsed)) {
                results.push(node);
            }
        });
        return results;
    };
    /*
    Helper rekursif untuk mengecek kecocokan step demi step dari kanan ke kiri.
     */
    SelectorMatcher.matchStepRecursive = function (node, steps, stepIndex) {
        if (stepIndex < 0)
            return true;
        if (!node)
            return false;
        var currentStep = steps[stepIndex];
        if (!this.matchSimpleSelector(node, currentStep.selector)) {
            return false;
        }
        if (stepIndex === 0)
            return true;
        var prevStepIndex = stepIndex - 1;
        var combinator = currentStep.combinator;
        switch (combinator) {
            case ">":
                return this.matchStepRecursive(node.parent, steps, prevStepIndex);
            case " ":
                var ancestor = node.parent;
                while (ancestor) {
                    if (this.matchStepRecursive(ancestor, steps, prevStepIndex))
                        return true;
                    ancestor = ancestor.parent;
                }
                return false;
            case "+":
                return this.matchStepRecursive(node.prevSibling, steps, prevStepIndex);
            case "~":
                var sibling = node.prevSibling;
                while (sibling) {
                    if (this.matchStepRecursive(sibling, steps, prevStepIndex))
                        return true;
                    sibling = sibling.prevSibling;
                }
                return false;
            default:
                return false;
        }
    };
    /*
    Mengecek apakah satu node cocok dengan kriteria SimpleSelector (Tag, ID, Class).
     */
    SelectorMatcher.matchSimpleSelector = function (node, simple) {
        if (!simple.universal && simple.tag && node.tag !== simple.tag) {
            return false;
        }
        if (simple.id && node.id !== simple.id) {
            return false;
        }
        if (simple.classes.length > 0) {
            var nodeClasses = node.classes;
            for (var _i = 0, _a = simple.classes; _i < _a.length; _i++) {
                var cls = _a[_i];
                if (!nodeClasses.includes(cls))
                    return false;
            }
        }
        return true;
    };
    return SelectorMatcher;
}());
exports.SelectorMatcher = SelectorMatcher;
