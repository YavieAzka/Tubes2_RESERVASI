import { SelectorToken, SelectorLexer } from "./selector-css";

export interface SimpleSelector{
    tag: string | null;
    id : string | null;
    classes: string[]; // bisa banyak class
    universal: boolean;
}

export type CombinatorType = " " | ">" | "~" | "+";

export interface SelectorStep{
    combinator: CombinatorType | null;
    selector: SimpleSelector;
}

export interface SelectorParsed{
    steps: SelectorStep[];
    before: string;
}

export class SelectorParser{
    public static parse(selector: string): SelectorParsed {
        const trimmed = selector.trim();
        if (trimmed.length == 0){
            throw new Error (`SelectorParser: Selecter kosong`);
        }

        const tokens = SelectorLexer.tokenize(trimmed);
        if (tokens.length === 0){
            throw new Error(`SelectorPaser: Hasil dari tokenize SelectorLexer kosong`);
        }
        return {
        steps: this.buildSteps(tokens),
        before: trimmed,
        };
    }

    private static buildSteps(tokens: SelectorToken[]): SelectorStep[]{
        const steps: SelectorStep[] = [];
        let curCombinator: CombinatorType | null = null;
        let buffer: SelectorToken[] = [];

        for (const token of tokens){
            if (token.type === "combinator"){
                if (buffer.length === 0){
                    throw new Error(`SelectorParser: Setelag combinator tidak ada simple selector`);
                }
                steps.push({combinator: curCombinator, selector: this.buildSimpleSelector(buffer),});

                buffer = [];
                curCombinator = token.type as CombinatorType;
            }
            else{
                buffer.push(token);
            }

            if (buffer.length === 0){
                throw new Error(`SelectorParser: Selector tidak boleh diakhir dengan combinator.`)
            }

            steps.push({combinator: curCombinator, selector: this.buildSimpleSelector(buffer),});
        }

        return steps;
    }


    private static buildSimpleSelector(buffer: SelectorToken[]): SimpleSelector{
        let tag: string | null = null;
        let id: string | null = null;
        const classes: string[] = [];
        let universal = false;

        for (const token of buffer){
            switch (token.type) {
                case "tag":
                    if(tag != null){
                        throw new Error(`SelectorParser: Tidak boleh ada 2 tag selector (${tag} dan ${token.value})`);
                    }
                    tag = token.value;
                    break;
            
                case "id":
                    if (id != null){
                        throw new Error (`SelectorParser: Tidak boleh ada 2 id selector (${id} dan ${token.value})`);
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
                    throw new Error(`SelectorParser: Token dengan tipe ${token.type} tidak valid.`);
            }
        }
    return{tag, id, classes, universal}
    }

    
}