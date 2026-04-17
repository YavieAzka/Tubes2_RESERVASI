"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOMNode = void 0;
var DOMNode = /** @class */ (function () {
    function DOMNode(tag) {
        this.tag = tag.toLowerCase(); // Standarisasi nama tag menjadi lowercase
        this.attributes = {};
        this.text = "";
        // Inisialisasi pointer relasi sebagai null/empty saat node baru dibuat
        this.parent = null;
        this.children = [];
        this.nextSibling = null;
        this.prevSibling = null;
    }
    // --- Helper Methods untuk Mempermudah CSS Matching ---
    /**
     * Menambahkan child node dan otomatis mengatur pointer parent & sibling.
     */
    DOMNode.prototype.addChild = function (child) {
        child.parent = this;
        if (this.children.length > 0) {
            var lastChild = this.children[this.children.length - 1];
            lastChild.nextSibling = child;
            child.prevSibling = lastChild;
        }
        this.children.push(child);
    };
    /**
     * Menyimpan atribut (seperti id, href, src).
     */
    DOMNode.prototype.setAttribute = function (key, value) {
        this.attributes[key] = value;
    };
    /**
     * Mengambil nilai atribut tertentu.
     */
    DOMNode.prototype.getAttribute = function (key) {
        return this.attributes[key] || null;
    };
    Object.defineProperty(DOMNode.prototype, "classes", {
        /**
         * Mengambil daftar class dalam bentuk array untuk mempermudah class selector (.).
         */
        get: function () {
            var classStr = this.attributes["class"];
            if (!classStr)
                return [];
            // Memecah string class berdasarkan spasi dan menghilangkan spasi berlebih
            return classStr.split(/\s+/).filter(function (c) { return c.length > 0; });
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(DOMNode.prototype, "id", {
        /**
         * Mengambil ID untuk mempermudah ID selector (#).
         */
        get: function () {
            return this.attributes["id"] || null;
        },
        enumerable: false,
        configurable: true
    });
    DOMNode.rehydrate = function (plainNode) {
        var node = new DOMNode(plainNode.tag);
        node.attributes = plainNode.attributes || {};
        node.text = plainNode.text || "";
        if (plainNode.children) {
            for (var _i = 0, _a = plainNode.children; _i < _a.length; _i++) {
                var child = _a[_i];
                var rehydratedChild = DOMNode.rehydrate(child);
                node.addChild(rehydratedChild);
            }
        }
        return node;
    };
    return DOMNode;
}());
exports.DOMNode = DOMNode;
