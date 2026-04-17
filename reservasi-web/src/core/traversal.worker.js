"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var worker_threads_1 = require("worker_threads");
var domtree_1 = require("./domtree");
var selector_matcher_1 = require("./selector-matcher");
var selector_parser_1 = require("./selector-parser");
// Helper untuk membuat tree menjadi array 1 dimensi
function flattenTree(root) {
    var result = [];
    var queue = [root];
    while (queue.length > 0) {
        var current = queue.shift();
        result.push(current);
        for (var _i = 0, _a = current.children; _i < _a.length; _i++) {
            var child = _a[_i];
            queue.push(child);
        }
    }
    return result;
}
worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.on("message", function (data) {
    var plainTree = data.plainTree, selector = data.selector, startIdx = data.startIdx, endIdx = data.endIdx;
    // Bangun ulang object DOMNode
    var root = domtree_1.DOMNode.rehydrate(plainTree);
    var parsedSelector = selector_parser_1.SelectorParser.parse(selector);
    // Ratakan tree untuk mendapatkan index yang sesuai dengan main thread
    var allNodes = flattenTree(root);
    // Cek kecocokan HANYA pada bagian (chunk) yang ditugaskan ke worker ini
    var matchedIndices = [];
    for (var i = startIdx; i < endIdx; i++) {
        if (i >= allNodes.length)
            break;
        if (selector_matcher_1.SelectorMatcher.matches(allNodes[i], parsedSelector)) {
            matchedIndices.push(i);
        }
    }
    // Kirim kembali index yang cocok ke main thread
    worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage(matchedIndices);
});
