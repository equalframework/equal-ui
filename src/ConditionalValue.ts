import { Domain } from "./Domain";

export type ConditionalValue = boolean | string | any[];

/**
 * Evaluate a boolean value that may be expressed as a domain.
 */
export function evaluateConditionalValue(
    value: ConditionalValue,
    object: any,
    user: any = {},
    parent: any = {},
    env: any = {},
    fallback: boolean = true
): boolean {
    console.debug('evaluateConditionalValue - evaluating value', JSON.stringify(value), object, user, env);

    if(typeof value === 'boolean') {
        return value;
    }

    let result = fallback;

    if(value.length) {
        if(value === 'false') {
            result = false;
        }
        else if(value === 'true') {
            result = true;
        }
        else {
            try {
                let array_domain = value;
                if(typeof array_domain === 'string') {
                    array_domain = JSON.parse(array_domain);
                }
                if(!Array.isArray(array_domain)) {
                    throw new Error('non array conditional domain');
                }
                result = new Domain(array_domain).evaluate(object, user, parent, env);
            }
            catch(error) {
                console.warn('Error parsing conditional value', value, error);
            }
        }
    }

    console.debug('evaluateConditionalValue - result', result);
    return result;
}
