"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreeTraversal = void 0;
var TreeTraversal = /** @class */ (function () {
    function TreeTraversal() {
    }
    TreeTraversal.bfs = function (root, onVisit) {
        var queue = [root];
        while (queue.length > 0) {
            var current = queue.shift();
            onVisit(current);
            for (var _i = 0, _a = current.children; _i < _a.length; _i++) {
                var child = _a[_i];
                queue.push(child);
            }
        }
    };
    TreeTraversal.dfs = function (root, onVisit) {
        onVisit(root);
        for (var _i = 0, _a = root.children; _i < _a.length; _i++) {
            var child = _a[_i];
            this.dfs(child, onVisit);
        }
    };
    return TreeTraversal;
}());
exports.TreeTraversal = TreeTraversal;
