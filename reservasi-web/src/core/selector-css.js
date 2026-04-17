"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectorLexer = void 0;
// Mecah string css selector jadi array selector token
var SelectorLexer = /** @class */ (function () {
    function SelectorLexer() {
    }
    SelectorLexer.tokenize = function (selector) {
        var tokens = [];
        var cursor = 0;
        var s = selector.trim(); //hapus spasi di awal dan akhir
        //  buat flag untuk bedain fungsi spasi
        var isPrevSimpleSelector = false;
        while (cursor < s.length) {
            var char = s[cursor];
            if (/\s/.test(char)) { // \s artinya =\t \n " "
                var j = cursor;
                while (j < s.length && /\s/.test(s[j]))
                    j++;
                var nextChar = s[j];
                // kasus 1:  spasi sebagai combinator
                if (isPrevSimpleSelector && nextChar != ">" && nextChar != "+" && nextChar != "~" && j < s.length) {
                    tokens.push({ type: "combinator", value: " " });
                    isPrevSimpleSelector = false;
                }
                cursor = j;
                continue;
            }
            // kasus2: combinator kusus (selain spasi)
            if (char == ">" || char == "+" || char == "~") {
                tokens.push({ type: "combinator", value: char });
                isPrevSimpleSelector = false;
                cursor++;
                continue;
            }
            //kasus3: universal selector
            if (char == "*") {
                tokens.push({ type: "universal", value: "*" });
                isPrevSimpleSelector = true;
                cursor++;
                continue;
            }
            //kasus4: id selector
            if (char == "#") {
                cursor++;
                var name_1 = SelectorLexer.readValue(s, cursor);
                if (name_1.length === 0)
                    throw new Error("SelectorLexer: ID selector '#' tidak ada value (posisi ".concat(cursor, ")"));
                tokens.push({ type: "id", value: name_1 });
                cursor += name_1.length;
                isPrevSimpleSelector = true;
                continue;
            }
            if (char == ".") {
                cursor++;
                var name_2 = SelectorLexer.readValue(s, cursor);
                if (name_2.length === 0) {
                    throw new Error("SelectorLexer: Class selector '.' tidak ada value yang valid (posisi ".concat(cursor, ")"));
                }
                tokens.push({ type: "class", value: name_2 });
                cursor += name_2.length;
                isPrevSimpleSelector = true;
                continue;
            }
            // kasus5: Tag selector
            if (/[a-zA-Z_]/.test(char)) {
                var name_3 = SelectorLexer.readValue(s, cursor);
                tokens.push({ type: "tag", value: name_3.toLowerCase() });
                cursor += name_3.length;
                isPrevSimpleSelector = true;
                continue;
            }
            // edge case: char not recognized
            throw new Error("SelectorLexer: Karakter tidak dikenali ".concat(char, " di posisi ").concat(cursor));
        }
        return tokens;
    };
    SelectorLexer.readValue = function (s, start) {
        var end = start;
        while (end < s.length && /[a-zA-Z0-9\-_]/.test(s[end])) {
            end++;
        }
        return s.substring(start, end);
    };
    return SelectorLexer;
}());
exports.SelectorLexer = SelectorLexer;
