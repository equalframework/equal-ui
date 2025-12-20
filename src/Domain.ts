import { EnvService } from "./equal-services";
import { DateReference } from "./DateReference";

/**
 * Class Domain manipulations
 * #memo - SharedLib should use the logic from this class for its own Widgets
 */
export class Domain {

    private clauses: Array<Clause>;
    static OPERATORS: Array<string> = ['=', '==', '!=', '<>', '>', '<', '<=', '>=', 'like', 'ilike', 'is', 'is not', 'in', 'not in', 'contains'] ;

    constructor(domain: Array<any>) {
        this.clauses = new Array<Clause>();
        this.fromArray(domain);
    }

    public fromArray(domain: Array<any>) {
        // reset clauses
        this.clauses.splice(0, this.clauses.length);
        /*
            supported formats :
            1) empty  domain : []
            2) 1 condition only : [ '{operand}', '{operator}', '{value}' ]
            3) 1 clause only (one or more conditions) : [ [ '{operand}', '{operator}', '{value}' ], [ '{operand}', '{operator}', '{value}' ] ]
            4) multiple clauses : [ [ [ '{operand}', '{operator}', '{value}' ], [ '{operand}', '{operator}', '{value}' ] ], [ [ '{operand}', '{operator}', '{value}' ] ] ]
        */
        let normalized = Domain.normalize(domain);

        for(let d_clause of normalized) {
            let clause = new Clause();
            for(let d_condition of d_clause) {
                clause.addCondition(new Condition(d_condition[0], d_condition[1], d_condition[2]))
            }
            this.addClause(clause);
        }
        return this;
    }

    public toArray() {
        let domain = new Array();
        for(let clause of this.clauses) {
            domain.push(clause.toArray());
        }
        return domain;
    }

    public getClauses() {
        return this.clauses;
    }

    public merge(domain:Domain) {
        let res_domain = new Array();
        let domain_a = domain.toArray();
        let domain_b = this.toArray();

        if(domain_a.length <= 0) {
            res_domain = domain_b;
        }
        else if(domain_b.length <= 0) {
            res_domain = domain_a;
        }
        else {
            for(let clause_a of domain_a) {
                for(let clause_b of domain_b) {
                    res_domain.push(clause_a.concat(clause_b));
                }
            }
        }
        return this.fromArray(res_domain);
    }

    public static isDomainConditionArray(candidate: any): boolean {
        return (
            Array.isArray(candidate) &&
            candidate.length === 3 &&
            typeof candidate[1] === 'string' &&
            Domain.OPERATORS.includes(candidate[1])
        );
    }

    private static normalize(domain: any): Array<any> {

        if(!Array.isArray(domain) || domain.length <= 0) {
            return [];
        }

        // CASE 1: single condition [operand, operator, value]
        // operand can be ANYTHING (string, array, number…)
        if(Domain.isDomainConditionArray(domain)) {
            return [[domain]];
        }

        // CASE 2 — single clause
        // [ [operand, operator, value], ... ]
        if(
            Array.isArray(domain[0]) &&
            Domain.isDomainConditionArray(domain[0])
        ) {
            return [domain];
        }

        // CASE 3 — already normalized
        // [ [ [operand, operator, value], ... ], ... ]
        if (
            Array.isArray(domain[0]) &&
            Array.isArray(domain[0][0]) &&
            Domain.isDomainConditionArray(domain[0][0])
        ) {
            return domain;
        }

        // fallback: invalid domain
        console.warn('Domain::normalize() - invalid domain structure', domain);
        return [];
    }


    /**
     * Add a clause at the Domain level : the clause is append to the Domain
     */
    public addClause(clause: Clause) {
        this.clauses.push(clause);
    }

    /**
     * Add a condition at the Domain level : the condition is added to each clause of the Domain
     */
    public addCondition(condition: Condition) {
        for(let clause of this.clauses) {
            clause.addCondition(condition);
        }
    }

    /**
     * Update domain by parsing conditions and replace any occurrence of `object.` and `user.` notations with related attributes of given objects.
     *
     * @param object    Object to parse the conditions with.
     * @param user      Current User instance.
     * @param parent    An entity object given as the parent of the referenced object, if any.
     *
     * @returns Domain  Returns current instance with updated values.
     */
    public parse(object: any = {}, user: any = {}, parent: any = {}, env: any = {}) {
        console.debug('Domain::parse', object, user, parent, env);
        for(let clause of this.clauses) {
            for(let condition of clause.conditions) {
                // adapt value according to its syntax ('user.' or 'object.')
                let value = condition.value;

                // handle object references as `value` part
                if(typeof value === 'string' && value.indexOf('object.') == 0) {
                    let path: string = value.substring('object.'.length);
                    let parts: string[] = path.split('.');
                    let target: any = object;

                    let has_unknown_field: boolean = false;

                    for(const subfield of parts) {
                        if(target == null || !target.hasOwnProperty(subfield)) {
                            has_unknown_field = true;
                            break;
                        }
                        target = target[subfield];
                    }
                    if(has_unknown_field) {
                        continue;
                    }
                    // target points to an object with subfields
                    if(typeof target === 'object' && !Array.isArray(target)) {
                        if(target === null) {
                            value = 'null';
                        }
                        else if(target.hasOwnProperty('id')) {
                            value = target.id;
                        }
                        else if(target.hasOwnProperty('name')) {
                            value = target.name;
                        }
                        else {
                            // target exists and is an empty object: resolve as null
                            value = 'null';
                        }
                    }
                    else {
                        value = target;
                    }
                }
                // handle user references as `value` part
                else if(typeof value === 'string' && value.indexOf('user.') == 0) {
                    let target = value.substring('user.'.length);
                    if(!user || !user.hasOwnProperty(target)) {
                        continue;
                    }
                    value = user[target];
                }
                else if(typeof value === 'string' && value.indexOf('parent.') == 0 ) {
                    let target = value.substring('parent.'.length);
                    if(!parent || !parent.hasOwnProperty(target)) {
                        continue;
                    }
                    let tmp = parent[target];
                    // target points to an object with subfields
                    if(typeof tmp === 'object' && !Array.isArray(tmp)) {
                        if(tmp === null) {
                            value = 'null';
                        }
                        else if(tmp.hasOwnProperty('id')) {
                            value = tmp.id;
                        }
                        else if(tmp.hasOwnProperty('name')) {
                            value = tmp.name;
                        }
                    }
                    else {
                        value = parent[target];
                    }
                }
                else if(typeof value === 'string' && value.indexOf('date.') == 0) {
                    value = (new DateReference(value)).getDate().toISOString();
                }
                else if(typeof value === 'string' && value.indexOf('env.') == 0) {
                    let target = value.substring('env.'.length);
                    if(!env || !env.hasOwnProperty(target)) {
                        value = false;
                    }
                    value = env[target];
                }

                condition.value = value;
            }
        }
        console.debug('Domain::parse result', JSON.stringify(this.toArray()));
        return this;
    }

    /**
     * Evaluate domain for a given object.
     * Object structure has to comply with the operands mentioned in the conditions of the domain. If no, related conditions are ignored (skipped).
     *
     * @param object
     * @returns boolean Return true if the object matches the domain, false otherwise.
     */
    public evaluate(object: any, user: any = {}, parent: any = {}, env: any = {}): boolean {
        console.debug('Domain::evaluate() - evaluating object', object, this);
        let res = false;
        if(this.clauses.length == 0) {
            return true;
        }
        // parse any reference to object in conditions
        this.parse(object, user, parent, env);
        // evaluate clauses (OR) and conditions (AND)
        for(let clause of this.clauses) {
            let c_res = true;
            for(let condition of clause.getConditions()) {

                let operand = condition.operand;
                let operator = condition.operator;
                let value = condition.value;

                if(typeof operand == 'string' && object.hasOwnProperty(operand)) {
                    operand = object[operand];
                    // handle many2one operands
                    if(typeof operand === 'object' && operand !== null) {
                        if(operand.hasOwnProperty('id')) {
                            operand = operand.id;
                        }
                        else {
                            operand = null;
                        }
                    }
                }
                else {
                    // #memo - in all other situations operand is a value that we use as-is for the comparison (integer, string, boolean)
                }

                let cc_res: boolean;

                // handle special cases
                if(operator == '=') {
                    operator = '==';
                }
                else if(operator == '<>') {
                    operator = '!=';
                }

                if(typeof operand == 'number') {
                    if(operator == 'is') {
                        operator = '==';
                    }
                    else if(operator == 'is not') {
                        operator = '!=';
                    }
                }

                if(operator == 'is') {
                    if( [true, 'true'].includes(value) ) {
                        cc_res = operand;
                    }
                    else if( [false, null, 'false', 'null', 'empty'].includes(value) ) {
                        cc_res = (['', false, undefined, null].includes(operand) || (Array.isArray(operand) && !operand.length));
                    }
                    else {
                        continue;
                    }
                }
                else if(operator == 'is not') {
                    if( [true, 'true'].includes(value) ) {
                        cc_res = !operand;
                    }
                    else if( [false, null, 'false', 'null', 'empty'].includes(value) ) {
                        cc_res = !(['', false, undefined, null].includes(operand) || (Array.isArray(operand) && !operand.length));
                    }
                    else {
                        continue;
                    }
                }
                else if(operator == 'in') {
                    if(!Array.isArray(value)) {
                        value = [value];
                    }
                    cc_res = (value.indexOf(operand) > -1);
                }
                else if(operator == 'not in') {
                    if(!Array.isArray(value)) {
                        value = [value];
                    }
                    cc_res = (value.indexOf(operand) == -1);
                }
                else if(operator == 'contains') {
                    if(!Array.isArray(operand)) {
                        continue;
                    }
                    cc_res = (operand.indexOf(value) > -1);
                }
                else {
                    let c_condition: string = '';
                    if(['<', '>'].includes(operator)) {
                        // we assume a comparision on numeric operands
                        let numeric_value = Number.isNaN(+value) ? 0 : +value;
                        c_condition = "( " + operand + " " + operator + " " + numeric_value + ")";
                    }
                    else {
                        c_condition = "( '" + operand + "' " + operator + " '" + value + "')";
                    }

                    cc_res = false;
                    try {
                        cc_res = Boolean(eval(c_condition));
                    }
                    catch(error) {
                        console.warn('Domain::evaluate() - Error evaluating condition', c_condition, error);
                    }
                }
                c_res = c_res && cc_res;
            }
            res = res || c_res;
        }
        console.debug('Domain::evaluate() - result', res);
        return res;
    }

    /**
     * Returns the resulting boolean value of the domain.
     * @returns boolean
     */
    public test(): boolean {
        let res = false;
        if(this.clauses.length == 0) {
            return true;
        }
        // parse any reference to object in conditions
        // evaluate clauses (OR) and conditions (AND)
        for(let clause of this.clauses) {
            let c_res = true;
            for(let condition of clause.getConditions()) {

                let operand = condition.operand;
                let operator = condition.operator;
                let value = condition.value;

                let cc_res: boolean;

                // handle special cases
                if(operator == '=') {
                    operator = '==';
                }
                else if(operator == '<>') {
                    operator = '!=';
                }

                if(typeof value == 'number') {
                    if(operator == 'is') {
                        operator = '==';
                    }
                    else if(operator == 'is not') {
                        operator = '!=';
                    }
                }

                if(operator == 'is') {
                    if( value === true ) {
                        cc_res = operand;
                    }
                    else if( [false, null, 'false', 'null', 'empty'].includes(value) ) {
                        cc_res = (['', false, undefined, null].includes(operand) || (Array.isArray(operand) && !operand.length) );
                    }
                    else {
                        continue;
                    }
                }
                else if(operator == 'is not') {
                    if( value === false ) {
                        cc_res = operand;
                    }
                    else if( [false, null, 'false', 'null', 'empty'].includes(value) ) {
                        cc_res = !(['', false, undefined, null].includes(operand) || (Array.isArray(operand) && !operand.length));
                    }
                    else {
                        continue;
                    }
                }
                else if(operator == 'in') {
                    if(!Array.isArray(value)) {
                        continue;
                    }
                    cc_res = (value.indexOf(operand) > -1);
                }
                else if(operator == 'not in') {
                    if(!Array.isArray(value)) {
                        continue;
                    }
                    cc_res = (value.indexOf(operand) == -1);
                }
                else if(operator == 'contains') {
                    if(!Array.isArray(operand)) {
                        continue;
                    }
                    cc_res = (operand.indexOf(value) > -1);
                }
                else {
                    let c_condition = "( '" + operand + "' " + operator + " '" + value + "')";

                    cc_res = false;
                    try {
                        cc_res = Boolean(eval(c_condition));
                    }
                    catch(error) {
                        console.warn('Domain::evaluate() - Error evaluating condition', c_condition, error);
                    }
                }
                c_res = c_res && cc_res;
            }
            res = res || c_res;
        }
        return res;
    }
}

export class Clause {
    public conditions: Array<Condition>;

    constructor(conditions:Array<Condition> = []) {
        if(conditions.length == 0) {
            this.conditions = new Array<Condition>();
        }
        else {
            this.conditions = conditions;
        }
    }

    public addCondition(condition: Condition) {
        this.conditions.push(condition);
    }

    public getConditions() {
        return this.conditions;
    }

    public toArray() {
        let clause = new Array();
        for(let condition of this.conditions) {
            clause.push(condition.toArray());
        }
        return clause;
    }
}

export class Condition {
    public operand:any;
    public operator:any;
    public value:any;

    constructor(operand: any, operator: any, value: any) {
        this.operand = operand;
        this.operator = operator;
        this.value = value;
    }

    public toArray() {
        let condition = new Array();
        condition.push(this.operand);
        condition.push(this.operator);
        condition.push(this.value ?? 'null');
        return condition;
    }

    public getOperand() {
        return this.operand;
    }

    public getOperator() {
        return this.operator;
    }

    public getValue() {
        return this.value;
    }

}

export class Reference {

    private value: any;

    constructor(value:any) {
        this.value = value;
    }

    /**
     * Update value by replacing any occurrence of `object.` and `user.` notations with related attributes of given objects.
     *
     * @param any   object  An entity object to serve as reference.
     * @param any   user    A user object to serve as reference.
     * @param any   parent  An entity object given as the parent of the referenced object, if any.
     * @returns string      The result of the parsing.
     */
    public parse(object: any, user: any = {}, parent: any = {}) {
        let result = this.value;
        // avoid parsing non-string values
        if(typeof this.value !== 'string' && !(this.value instanceof String)) {
            return result;
        }
        if(this.value.indexOf('object.') == 0 ) {
            let target = this.value.substring('object.'.length);
            if(object && object.hasOwnProperty(target)) {
                let tmp = object[target];
                // target points to an object with subfields
                if(tmp && typeof tmp === 'object' && !Array.isArray(tmp)) {
                    if(tmp.hasOwnProperty('id')) {
                        result = tmp.id;
                    }
                    else if(tmp.hasOwnProperty('name')) {
                        result = tmp.name;
                    }
                }
                else {
                    result  = object[target];
                }
            }
        }
        // handle user references as `value` part
        else if(this.value.indexOf('user.') == 0) {
            let target = this.value.substring('user.'.length);
            if(user && user.hasOwnProperty(target)) {
                result = user[target];
            }
        }
        else if(this.value.indexOf('parent.') == 0 ) {
            let target = this.value.substring('parent.'.length);
            if(parent && parent.hasOwnProperty(target)) {
                let tmp = parent[target];
                // target points to an object with subfields
                if(tmp && typeof tmp === 'object' && !Array.isArray(tmp)) {
                    if(tmp.hasOwnProperty('id')) {
                        result = tmp.id;
                    }
                    else if(tmp.hasOwnProperty('name')) {
                        result = tmp.name;
                    }
                }
                else {
                    result  = parent[target];
                }
            }
        }
        return result;
    }
}

export default Domain;