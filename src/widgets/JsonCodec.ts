import {
    getNodeValue,
    Node,
    ParseError,
    parseTree,
    printParseErrorCode
} from 'jsonc-parser';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | {[key: string]: JsonValue};

export interface JsonParseResult {
    valid: boolean;
    empty: boolean;
    value?: JsonValue;
    normalized: string;
    error: string | null;
}

export default class JsonCodec {

    public static parse(input: any): JsonParseResult {
        const source = JsonCodec.toSource(input);

        if(source.trim() === '') {
            return {
                valid: true,
                empty: true,
                normalized: '',
                error: null
            };
        }

        const errors: ParseError[] = [];
        const tree = parseTree(source, errors, {
            allowTrailingComma: false,
            disallowComments: true,
            allowEmptyContent: false
        });

        if(!tree || errors.length > 0) {
            const error = errors[0];
            return {
                valid: false,
                empty: false,
                normalized: source,
                error: error
                    ? JsonCodec.formatError(source, error.offset, printParseErrorCode(error.error))
                    : 'Invalid JSON.'
            };
        }

        const duplicate = JsonCodec.findDuplicateProperty(tree);
        if(duplicate) {
            return {
                valid: false,
                empty: false,
                normalized: source,
                error: JsonCodec.formatError(
                    source,
                    duplicate.offset,
                    `Duplicate property "${duplicate.key}".`
                )
            };
        }

        const value = getNodeValue(tree) as JsonValue;
        return {
            valid: true,
            empty: false,
            value,
            normalized: JSON.stringify(value, null, 4),
            error: null
        };
    }

    public static compact(value: JsonValue): string {
        return JSON.stringify(value);
    }

    private static toSource(input: any): string {
        if(input === null || input === undefined) {
            return '';
        }
        if(typeof input === 'string') {
            return input;
        }
        return JSON.stringify(input);
    }

    private static findDuplicateProperty(node: Node): {key: string, offset: number} | null {
        if(node.type === 'object') {
            const properties = new Set<string>();
            for(const property of node.children ?? []) {
                const keyNode = property.children?.[0];
                const valueNode = property.children?.[1];
                const key = String(keyNode?.value ?? '');
                if(properties.has(key)) {
                    return {key, offset: keyNode?.offset ?? property.offset};
                }
                properties.add(key);
                if(valueNode) {
                    const duplicate = JsonCodec.findDuplicateProperty(valueNode);
                    if(duplicate) {
                        return duplicate;
                    }
                }
            }
        }
        else if(node.type === 'array') {
            for(const child of node.children ?? []) {
                const duplicate = JsonCodec.findDuplicateProperty(child);
                if(duplicate) {
                    return duplicate;
                }
            }
        }
        return null;
    }

    private static formatError(source: string, offset: number, message: string): string {
        const prefix = source.slice(0, Math.max(0, offset));
        const lines = prefix.split(/\r\n|\r|\n/);
        const line = lines.length;
        const column = (lines[lines.length - 1]?.length ?? 0) + 1;
        return `${message} (line ${line}, column ${column})`;
    }
}
