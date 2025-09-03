import { $ } from "./jquery-lib";
import { ApiService } from "./equal-services";

import { View, Layout, Domain } from "./equal-lib";
/**
 * Class for Model interactions
 * Acts like server-side Collection.class.php
 */
export class Model {

    private view: View;

    // Collection (array) of objects (we use array to maintain objects order)
    private objects: any[];

    // Map for keeping track of the fields that have been changed, on an object basis (keys are objects ids)
    private has_changed: any;

    // total objects matching the current domain on the back-end
    private total: number;

    private loaded_promise: any;



    // Collections do not deal with lang: it is used from EnvService in ApiService

    constructor(view: View) {
        this.view = view;

        this.loaded_promise = $.Deferred();

        this.has_changed = {};
        this.objects = [];
        this.total = 0;
    }


    public async init() {
        try {
            await this.refresh();
        }
        catch(err) {
            console.warn('Something went wrong ', err);
        }
    }

    private deepCopy(obj: any):any {
        var copy:any;

        // Handle the 3 simple types, and null or undefined
        if (null == obj || "object" != typeof obj) return obj;

        // Handle Date
        if (obj instanceof Date) {
            copy = new Date();
            copy.setTime(obj.getTime());
            return copy;
        }

        // Handle Array
        if (obj instanceof Array) {
            copy = [];
            for (var i = 0, len = obj.length; i < len; i++) {
                copy[i] = this.deepCopy(obj[i]);
            }
            return copy;
        }

        // Handle Object
        if (obj instanceof Object) {
            copy = {};
            for (var attr in obj) {
                if (obj.hasOwnProperty(attr)) copy[attr] = this.deepCopy(obj[attr]);
            }
            return copy;
        }

        throw new Error("Unable to copy obj! Its type isn't supported.");
    }

    public async getModelDefaults() {
        // create a new object as draft
        let fields: any = {state: 'draft'};
        let schema: any = this.view.getModelFields();
        // use given domain for setting default values
        let domain = new Domain(this.view.getDomain());
        for(let clause of domain.getClauses()) {
            for(let condition of clause.getConditions()) {
                let field  = condition.getOperand();
                if(field == 'id') {
                    continue;
                }
                if(['ilike', 'like', '=', 'is'].includes(condition.getOperator()) && schema.hasOwnProperty(field)) {
                    fields[field] = condition.getValue();
                }
            }
        }
        return fields;
    }

    /**
     * Resolve the final type of a given field (handling 'alias' and 'computed').
     *
     * @param field
     * @returns string The final type. If final type cannot be resolved, the 'string' type is returned as default.
     */
    public getFinalType(field: string): string | null {
        let result = null;
        let schema = this.view.getModelFields();
        if(schema) {
            while(schema.hasOwnProperty(field) && schema[field].hasOwnProperty('type') && schema[field].type == 'alias' && schema[field].hasOwnProperty('alias')) {
                field = schema[field].alias;
            }
            if(schema.hasOwnProperty(field) && schema[field].hasOwnProperty('type')) {
                if(schema[field].type == 'computed') {
                    if(schema[field].hasOwnProperty('result_type')) {
                        result = schema[field].result_type;
                    }
                }
                else {
                    result = schema[field].type;
                }
            }
        }
        return result;
    }

    public getOperators(type:string) {
        let operators:any = {
            'boolean':      ['=', '<>'],
            'integer':      ['=', 'in', 'not in', '<>', '<', '>', '<=', '>='],
            'float':        ['=', '<>', '<', '>', '<=', '>='],
            'string':       ['like', 'in', '=', '<>'],
            'text':         ['like', '='],
            'date':         ['=', '<=', '>='],
            'time':         ['=', '<=', '>='],
            'datetime':     ['=', '<=', '>='],
            'file':         ['like', '='],
            'binary':       ['like', '='],
            'many2one':     ['=', '<>'],
            'one2many':     ['contains'],
            'many2many':    ['contains']
        };
        return operators[type];
    }

    public hasChanged() : boolean {
        return (Object.keys(this.has_changed).length > 0);
    }

    public export(object: any) {
        console.debug('Model::export', object);
        let result:any = {};
        let schema = this.view.getModelFields();
        for(let field in schema) {
            if(!object.hasOwnProperty(field)) {
                continue;
            }
            let type: string | null = this.getFinalType(field);
            if(type == 'many2one') {
                if(typeof object[field] == 'object' && object[field]) {
                    result[field] = object[field].id;
                }
                else {
                    result[field] = (object[field]) ? object[field] : 'null';
                }
            }
            else if(type && ['time', 'date', 'datetime'].indexOf(type) > -1) {
                result[field] = (object[field] && object[field].length) ? object[field] : 'null';
            }
            else if(type && ['one2many', 'many2many'].indexOf(type) > -1) {
                // #todo
                result[field] = object[field];
            }
            else {
                result[field] = object[field];
            }
        }
        return result;
    }

    public getFieldsProjection(): string[] {
        // fetch fields that are present in the parent View
        let view_fields: any = this.view.getViewFields();
        let schema = this.view.getModelFields();

        let fields: string[] = [];

        for(let field in view_fields) {

            // view item as provided in view schema
            let item: any = view_fields[field];

            // path to subfield, for relational fields (when dot notation is present)
            let path: string = '';

            if(field.indexOf('.') > 0) {
                let parts: string[] = field.split('.');
                field = <string> parts.shift();
                path = parts.join('.');
            }

            if(!schema || !schema.hasOwnProperty(field)) {
                console.warn('unknown field', field);
                continue;
            }
            let type: string | null = this.getFinalType(field);
            // append `name` subfield for relational fields, using the dot notation
            if('many2one' == type) {
                fields.push(field + '.name');
                // append path to subfield, if any
                if(path.length > 0) {
                    fields.push(field + '.' + path);
                }
                if(item.hasOwnProperty('widget') && item.widget.hasOwnProperty('fields') && Array.isArray(item.widget.fields)) {
                    for(let subfield of item.widget.fields) {
                        fields.push(field + '.' + subfield);
                    }
                }
            }
            // we do not load relational fields, these can result in potentially long lists which are handled by the Widgets
            else if(type && ['one2many', 'many2many'].indexOf(type) > -1) {
                // ignore
            }
            else {
                fields.push(field);
            }
        }

        // force adding special fields
        // #todo - complete the list
        if(schema.hasOwnProperty('status')) {
            fields.push('status');
        }
        if(schema.hasOwnProperty('order')) {
            fields.push('order');
        }

        return fields;
    }

    /**
     * Update model by requesting data from server using parent View parameters
    */
    public async refresh(full: boolean = false) {
        console.debug('Model::refresh');

        try {
            let body: any = {
                    get: this.view.getController(),
                    entity: this.view.getEntity(),
                    fields: this.getFieldsProjection(),
                    domain: this.view.getDomain(),
                    ...this.view.getParams()
                };

            // fetch objects using controller given by View (default is core_model_collect)
            let response = await ApiService.fetch('/', body);
            this.total = ApiService.getLastCount();
            if(response) {
                this.objects = response;
            }
            this.loaded_promise.resolve();
        }
        catch(response) {
            console.warn('Unable to fetch Collection from server', response);
            this.objects = [];
            this.loaded_promise.resolve();
            this.total = 0;
        }
        // trigger model change handler in the parent View (in order to update the layout)
        await this.view.onchangeModel(full);
    }

    /**
     * React to external request of Model change (one ore more objects in the collection have been updated through the Layout).
     * Changes are made on a field basis.
     *
     */
    public change(ids: Array<any>, values: any) {
        console.debug('Model::change', ids, values);
        let schema = this.view.getModelFields();
        for(let index in this.objects) {
            let object = this.objects[index];
            for(let id of ids) {
                if(object.hasOwnProperty('id') && object.id == id) {
                    for(let field in values) {
                        if(schema.hasOwnProperty(field)) {
                            if(!this.has_changed.hasOwnProperty(id)) {
                                this.has_changed[id] = [];
                            }
                            // update field
                            this.objects[index][field] = values[field];
                            // mark field as changed
                            this.has_changed[id].push(field);
                        }
                    }
                }
            }
        }
    }

    /**
     * Handler for resetting change status and modified field of a given object, when an update occured and was accepted by server.
     *
     * @param id
     * @param values
     */
    public reset(id: number, values: any) {
        console.debug('Model::reset', values);
        for(let index in this.objects) {
            let object = this.objects[index];
            if(object.hasOwnProperty('id') && object.id == id) {
                this.has_changed[id] = [];
                for(let field in values) {
                    object[field] = values[field];
                }
            }
        }
    }

    public ids() {
        if(this.objects.length == 0) {
            return [];
        }
        return this.objects.map( (object:any) => object.id );
    }

    /**
     * Return the Collection.
     * The result set can be limited to a subset of specific objects by specifying an array of ids.
     *
     * @param ids array list of objects identifiers that must be returned
     */
    public get(ids:any[] = []) {
        console.debug('Model::get', this.objects, this.has_changed);
        let promise = $.Deferred();
        this.loaded_promise
            .then( () => {
                if(ids.length) {
                    // create a custom collection by filtering objects on their ids
                    promise.resolve( this.objects.filter( (object:any) => ids.indexOf(+object['id']) > -1 ) );
                }
                else {
                    // return the full collection
                    promise.resolve(this.objects);
                }
            })
            .catch( () => promise.resolve({}) );

        return promise;
    }

    /**
     * Manually assign a list of objects from the current set (identified by their ids) to a given value (object).
     *
     * @param ids
     * @param object
     */
    public async set(ids:number[] = [], object: any) {
        if(!ids) {
            return;
        }
        for(let id of ids) {
            let index = this.objects.findIndex( (o:any) => o.id == id );
            this.objects[index] = this.deepCopy(object);
        }
        await this.view.onchangeModel();
    }

    public async add(object: any) {
        if(!object || typeof object !== 'object') {
            console.warn('Invalid object passed to Model::add');
            return;
        }

        if(!object.hasOwnProperty('id')) {
            object.id = 0;
        }

        const index = this.objects.findIndex((o: any) => o.id == object.id);
        if(index !== -1) {
            console.warn('Duplicate object id for call to Model::add');
            return;
        }
        // Deep copy to ensure no reference issues
        // this.objects.push(this.deepCopy(object));
        this.objects.push(object);

        ++this.total;
    }

    /**
     * Returns a collection holding only modified objects with their modified fields (not original objects).
     * The collection will be empty if no changes occurred.
     *
     * @param ids array list of objects identifiers that must be returned (if changed)
     */
    public getChanges(ids:any[] = []) {
        if(!ids) {
            return [];
        }
        let collection = [];
        for(let id in this.has_changed) {
            if(ids.length && ids.indexOf(+id) < 0) {
                continue;
            }
            let fields = this.has_changed[id];
            let object = this.objects.find( (object:any) => object.id == id );
            if(object == undefined) {
                continue;
            }
            let result: any = {id: id};
            for(let field of fields) {
                result[field] = object[field];
            }
            // force appending `state`and `modified` fields (when present) for concurrency control
            if(object.hasOwnProperty('modified')) {
                result['modified'] = object.modified;
            }
            if(object.hasOwnProperty('state')) {
                result['state'] = object.state;
            }
            collection.push(result);
        }
        return collection;
    }

    public getTotal() {
        return this.total;
    }
}

export default Model;