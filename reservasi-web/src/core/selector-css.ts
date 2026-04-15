
// export type -> artinya value cuman boleh ada di list
export type SelectorTokenType = 
    | "tag" // contoh: div, p, span,
    | "class" // contoh: .hi -> value = "hi"
    | "id" // contoh: #header -> value = "header"
    | "universal" // *
    | "combinator"; // >, +, " {spasi} " (descendant)

// interface -> buat objek
export interface SelectorToken{
    type: SelectorTokenType;
    value: string;
}

// Mecah string css selector jadi array selector token
export class SelectorLexer{
    public static tokenize(selector: string): SelectorToken[]{
        const tokens: SelectorToken[] = [];
        let cursor = 0;
        const s = selector.trim() //hapus spasi di awal dan akhir

        //  buat flag untuk bedain fungsi spasi
        let isPrevSimpleSelector = false;
        while (cursor < s.length){
            const char = s[cursor];
            if (/\s/.test(char)){// \s artinya =\t \n " "
                let j = cursor;
                while (j < s.length && /\s/.test(s[j])) j++;
                const nextChar = s[j];
                // kasus 1:  spasi sebagai combinator
                if (isPrevSimpleSelector && nextChar != ">" && nextChar!= "+" && nextChar != "~" && j < s.length){
                    tokens.push({type: "combinator", value: " "})
                    isPrevSimpleSelector = false;
                }

                cursor = j;
                continue;
            }
            
            // kasus2: combinator kusus (selain spasi)
            if (char == ">" || char == "+" || char == "~"){
                tokens.push({type: "combinator", value: char});
                isPrevSimpleSelector = false;
                cursor++;
                continue;
            }

            //kasus3: universal selector
            if (char == "*"){
                tokens.push({type: "universal", value: "*"});
                isPrevSimpleSelector = true;
                cursor++;
                continue;
            }

            //kasus4: id selector
            if (char == "#"){
                cursor++;
                const name = SelectorLexer.readValue(s, cursor);
                if(name.length === 0)
                    throw new Error(`SelectorLexer: ID selector '#' tidak ada value (posisi ${cursor})`);
                tokens.push({type: "id", value: name});
                cursor += name.length;
                isPrevSimpleSelector = true;
                continue;
            }
            if (char == "."){
                cursor++;
                const name = SelectorLexer.readValue(s, cursor);
                if (name.length === 0) {
                    throw new Error(`SelectorLexer: Class selector '.' tidak ada value yang valid (posisi ${cursor})`);
                }
                tokens.push({type: "class", value: name});
                cursor += name.length;
                isPrevSimpleSelector = true;
                continue;
            }

            // kasus5: Tag selector
            if (/[a-zA-Z_]/.test(char)){
                const name = SelectorLexer.readValue(s, cursor);
                tokens.push({type: "tag", value: name.toLowerCase()});
                cursor+= name.length;
                isPrevSimpleSelector = true;
                continue;
            }
            
            // edge case: char not recognized
            throw new Error(`SelectorLexer: Karakter tidak dikenali ${char} di posisi ${cursor}`)

        }

        return tokens;

    }

    public static readValue(s: string, start:number): string {
        let end = start;
        while(end < s.length && /[a-zA-Z0-9\-_]/.test(s[end])){
            end++;
        }
        return s.substring(start, end);
    }
}