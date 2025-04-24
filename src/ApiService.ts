import { $ } from "./jquery-lib";
import { EnvService, TranslationService } from "./equal-services";
import { saveAs } from 'file-saver';

/**
 * This service acts as an interface between client and server and caches view objects to lower the traffic
 * Contents that can be cached are :
 * - Views
 * - Menus
 * - Translations
 * - Schemas
 */
export class _ApiService {

    /**
     * Internal objects for cache management
     * These are Map objects for storing promises of requests
     */
    private views: any;
    private translations: any;
    private schemas: any;

    private last_count: number;
    private last_status: number;
    private last_headers: any;


    constructor() {
        $.ajaxSetup({
            cache: true,            // allow browser to cache the responses
            beforeSend: (xhr) => {
                /*
                // #removed for XSS protection (we use httpOnly cookie instead)
                let access_token = this.getCookie('access_token');
                if(access_token) {
                    xhr.setRequestHeader('Authorization', "Basic " + access_token);
                }
                */
            },
            xhrFields: { withCredentials: true },
            // #memo - this might be necessary when using cross-domain or distinct ports on same domain (TEST only)
            // crossDomain: true
        });

        this.views = {};
        this.translations = {};
        this.schemas = {};

        this.last_count = 0;
        this.last_status = 0;
        this.last_headers = {};
    }


    /**
     * ObjectManager methods
     */
    private getPackageName(entity:string) {
        return entity.substr(0, entity.indexOf('\\'));
    }

    private getClassName(entity:string) {
        return entity.substr(entity.indexOf('\\')+1);
    }


    /**
     * schemas methods
     */
    private loadSchema(entity: string, domain: any[]) {
        var package_name = this.getPackageName(entity);
        var class_name = this.getClassName(entity);

        if(typeof(this.schemas[package_name]) == 'undefined'
        || typeof(this.schemas[package_name][class_name]) == 'undefined') {
            if(typeof(this.schemas[package_name]) == 'undefined') {
                this.schemas[package_name] = {};
            }
            this.schemas[package_name][class_name] = $.Deferred();

            EnvService.getEnv().then( (environment:any) => {
                $.get({
                    url: environment.backend_url+'?get=model_schema&entity=' + entity + '&domain=' + JSON.stringify(domain)
                })
                .then( (json_data) => {
                    this.schemas[package_name][class_name].resolve(json_data);
                })
                .catch( (response:any) => {
                    console.debug('ApiService::loadSchema error', response.responseJSON);
                    this.schemas[package_name][class_name].resolve({});
                });
            })

        }
       return this.schemas[package_name][class_name];
    }

    // the view_id matches the following convention : view_type.view_name
    private loadView(entity:string, view_id:string) {
        var package_name = this.getPackageName(entity);
        var class_name = this.getClassName(entity);

        if(typeof(this.views[package_name]) == 'undefined'
        || typeof(this.views[package_name][class_name]) == 'undefined'
        || typeof(this.views[package_name][class_name][view_id]) == 'undefined') {
            if(typeof(this.views[package_name]) == 'undefined') {
                this.views[package_name] = {};
            }
            if(typeof(this.views[package_name][class_name]) == 'undefined') {
                this.views[package_name][class_name] = {};
            }
            this.views[package_name][class_name][view_id] = $.Deferred();
            EnvService.getEnv().then( (environment:any) => {
                $.get({
                    url: environment.backend_url+'?get=model_view&entity='+entity+'&view_id='+view_id
                })
                .then( (json_data) => {
                    this.views[package_name][class_name][view_id].resolve(json_data);
                })
                .catch( (response:any) => {
                    // #todo : upon 403, redirect to /auth
                    // if a 403 response is received, we assume that the user is not identified: redirect to /auth
                    // if(response.status == 403) {
                    //     window.location.href = '/auth';
                    // }
                    console.debug('ApiService::loadView error', response.responseJSON);
                    this.views[package_name][class_name][view_id].resolve({});
                });
            });
        }
        return this.views[package_name][class_name][view_id];
    }

    private loadTranslation(entity:string, lang:string) {
        var package_name = this.getPackageName(entity);
        var class_name = this.getClassName(entity);

        if(typeof(this.translations[package_name]) == 'undefined'
                || typeof(this.translations[package_name][class_name]) == 'undefined'
                || typeof(this.translations[package_name][class_name][lang]) == 'undefined') {
            if(typeof(this.translations[package_name]) == 'undefined') {
                this.translations[package_name] = {};
            }
            if(typeof(this.translations[package_name][class_name]) == 'undefined') {
                this.translations[package_name][class_name] = {};
            }
            this.translations[package_name][class_name][lang] = $.Deferred();

            EnvService.getEnv().then( (environment:any) => {
                // #todo change to ?get=translation (requires equal2.0)
                $.get({
                    url: environment.backend_url+'?get=config_i18n&entity='+entity+'&lang='+lang
                })
                .then( (json_data) => {
                    this.translations[package_name][class_name][lang].resolve(json_data);
                })
                .catch( (response:any) => {
                    this.translations[package_name][class_name][lang].resolve({});
                });
            });
        }
        // stored object is a promise, that might or might not be resolved,
        // with either translation object or empty object if no translation was found
        return this.translations[package_name][class_name][lang];
    }

    public getLastStatus() {
        return this.last_status;
    }

    public getLastCount() {
        return this.last_count;
    }

    public getLastHeaders() {
        return this.last_headers;
    }

    private setLastStatus(last_status: number) {
        this.last_status = last_status;
    }

    private setLastHeaders(headers: string) {
        // convert headers string to an array
        const headers_array: string[] = headers.trim().split(/[\r\n]+/);
        // reset
        this.last_headers = {};
        // create a map of header names to values
        headers_array.forEach((line) => {
            const parts: string[] = line.split(': ');
            const header: string = <string> parts.shift();
            const value: string = parts.join(': ');
            this.last_headers[header] = value;
        });
    }

    public async getTranslation(entity:string, locale:string = '') {
        const environment = await EnvService.getEnv();
        const translation = await this.loadTranslation(entity, (locale.length) ? locale : environment.locale);
        return translation;
    }

    public async getSchema(entity: string, domain: any[] = []) {
        const schema = await this.loadSchema(entity, domain);
        return schema;
    }

	public async getView(entity:string, view_id:string) {
        const view = await this.loadView(entity, view_id);
        return view;
    }

    public async getUser() {
        let result: any;
        try {
            const environment = await EnvService.getEnv();
            const response = await $.get({
                url: environment.rest_api_url + 'userinfo'
            });
            result = response;
        }
        catch(response:any) {
            throw response.responseJSON;
        }
        return result;
    }

    public async getSettings() {
        let result: any = {};
        /*
        try {
            const environment = await EnvService.getEnv();
            const response = await $.get({
                url: environment.rest_api_url+'envinfo'
            });
            result = response;
        }
        catch(response:any) {
            throw response.responseJSON;
        }
        */
        return result;
    }

    public fetch(route: string, body: any = {}, content_type: string = 'application/json') {
        return new Promise<any>( async (resolve, reject) => {
            try {
                const environment = await EnvService.getEnv();
                // make sure not to double the trailing slash
                let url = environment.backend_url + route.replace(/^\//g, '');
                let xhr = new XMLHttpRequest();
                xhr.open('GET', url + '?' + jQuery.param(body), true);

                // default to JSON
                if(content_type == 'application/json') {
                    xhr.responseType = "json";
                }
                // by convention, for application/* content, we request a conversion to ArrayBuffer
                else if(['text/plain', 'text/html'].indexOf(content_type) < 0) {
                    xhr.responseType = "arraybuffer";
                }
                // fallback to plain text (to support 'text/plain' and 'text/html')
                else {
                    xhr.responseType = "text";
                }

                xhr.withCredentials = true;
                xhr.send(null);

                xhr.onload = () => {
                    this.setLastStatus(xhr.status);
                    this.setLastHeaders(xhr.getAllResponseHeaders());

                    if(xhr.status < 200 || xhr.status > 299) {
                        reject(xhr.response)
                    }
                    else {
                        if(xhr.getResponseHeader('X-Total-Count')) {
                            this.last_count = parseInt( <string> xhr.getResponseHeader('X-Total-Count') );
                        }
                        resolve(xhr.response);
                    }
                };
            }
            catch(error:any) {
                reject(error);
            }
        });
    }

    public call(route:string, body:any = {}, content_type:string = 'application/json') {
        return new Promise<any>( async (resolve, reject) => {
            try {
                const environment = await EnvService.getEnv();
                // make sure not to double the trailing slash
                let url = environment.backend_url + route.replace(/^\//g, '');
                let xhr = new XMLHttpRequest();
                xhr.open('POST', url, true);
                xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
                var params = jQuery.param(body);

                // default to JSON
                if(content_type == 'application/json') {
                    xhr.responseType = "json";
                }
                // by convention, for application/* content, we request a conversion to ArrayBuffer
                else if(['text/plain', 'text/html'].indexOf(content_type) < 0) {
                    xhr.responseType = "arraybuffer";
                }
                // fallback to plain text (to support 'text/plain' and 'text/html')
                else {
                    xhr.responseType = "text";
                }

                xhr.withCredentials = true;
                xhr.send(params);

                xhr.onload = () => {
                    this.setLastStatus(xhr.status);
                    this.setLastHeaders(xhr.getAllResponseHeaders());

                    if(xhr.status < 200 || xhr.status > 299) {
                        reject(xhr.response)
                    }
                    else {
                        resolve(xhr.response);
                    }
                };
            }
            catch(error:any) {
                reject(error);
            }
        });
    }

    public async create(entity:string, fields:any = {}) {
        let result: any;
        try {
            const environment = await EnvService.getEnv();

            let params = {
                entity: entity,
                fields: fields,
                lang: environment.lang
            };

            const response = await $.get({
                url: environment.backend_url+'?do=model_create',
                dataType: 'json',
                data: params,
                contentType: 'application/x-www-form-urlencoded; charset=utf-8'
            });
            result = response;
        }
        catch(error: any) {
            this.setLastStatus(error.status);
            if(error.status >= 200 && error.status <= 299) {
                result = error.responseJSON;
            }
            else {
                throw error.responseJSON;
            }
        }
        return result;
    }

    public async read(entity:string, ids:any[], fields:string[], lang: string = '') {
        let result: any;
        try {
            const environment = await EnvService.getEnv();
            let params = {
                entity: entity,
                ids: ids,
                fields: fields,
                lang: (lang.length)?lang:environment.lang
            };
            const response = await $.get({
                url: environment.backend_url+'?get=model_read',
                dataType: 'json',
                data: params,
                contentType: 'application/x-www-form-urlencoded; charset=utf-8'
            });
            result = response;
        }
        catch(response:any) {
            throw response.responseJSON;
        }
        return result;
    }

    public async delete(entity:string, ids:any[], permanent:boolean=false) {
        let result: any;
        try {
            const environment = await EnvService.getEnv();
            let params = {
                    entity: entity,
                    ids: ids,
                    permanent: permanent
                };
            const response = await $.get({
                    url: environment.backend_url+'?do=model_delete',
                    dataType: 'json',
                    data: params,
                    contentType: 'application/x-www-form-urlencoded; charset=utf-8'
                });
            result = response;
        }
        catch(error: any) {
            this.setLastStatus(error.status);
            if(error.status >= 200 && error.status <= 299) {
                result = error.responseJSON;
            }
            else {
                throw error.responseJSON;
            }
        }
        return result;
    }

    public async archive(entity:string, ids:any[]) {
        let result: any;
        try {
            const environment = await EnvService.getEnv();
            let params = {
                entity: entity,
                ids: ids
            };
            const response = await $.get({
                url: environment.backend_url+'?do=model_archive',
                dataType: 'json',
                data: params,
                contentType: 'application/x-www-form-urlencoded; charset=utf-8'
            });
            result = response;
        }
        catch(error: any) {
            this.setLastStatus(error.status);
            if(error.status >= 200 && error.status <= 299) {
                result = error.responseJSON;
            }
            else {
                throw error.responseJSON;
            }
        }
        return result;
    }

    /**
     * Update a collection of objects.
     * In practice, eqUI always updates one object at a time (through form or list inline editing)
     *
     * @param entity
     * @param ids
     * @param fields
     */
    public async update(entity:string, ids:any[], fields:any, force: boolean=false, lang: string = '') {
        console.debug('ApiService::update', entity, ids, fields);
        let result: any = true;
        try {
            const environment = await EnvService.getEnv();
            let params = {
                entity: entity,
                ids: ids,
                fields: fields,
                lang: (lang.length)?lang:environment.lang,
                force: force
            };
            const response = await $.post({
                url: environment.backend_url+'?do=model_update',
                dataType: 'json',
                data: params,
                contentType: 'application/x-www-form-urlencoded; charset=utf-8'
            });
            result = response;
        }
        catch(error: any) {
            this.setLastStatus(error.status);
            if(error.status >= 200 && error.status <= 299) {
                result = error.responseJSON;
            }
            else {
                throw error.responseJSON;
            }
        }
        return result;
    }

    public async clone(entity:string, ids:any[]) {
        let result: any;
        try {
            const environment = await EnvService.getEnv();
            let params = {
                entity: entity,
                ids: ids,
                lang: environment.lang
            };
            const response = await $.get({
                url: environment.backend_url+'?do=model_clone',
                dataType: 'json',
                data: params,
                contentType: 'application/x-www-form-urlencoded; charset=utf-8'
            });
            result = response;
        }
        catch(error: any) {
            this.setLastStatus(error.status);
            if(error.status >= 200 && error.status <= 299) {
                result = error.responseJSON;
            }
            else {
                throw error.responseJSON;
            }
        }
        return result;
    }

    /**
     * Search for objects matching the given domain and return a list of objects holding requested fields and their values.
     *
     * @param entity
     * @param domain
     * @param fields
     * @param order     name of the field on which sort the collection
     * @param sort      'asc' or 'desc'
     * @param start
     * @param limit
     * @param lang
     * @returns     Promise     Upon success, the promise is resolved into an Array holding matching objects (collection).
     */
    public async collect(entity:string, domain:any[], fields:any[], order:string, sort:string, start:number, limit:number, lang: string = '') {
        console.debug('ApiService::collect', entity, domain, fields, order, sort, start, limit);
        var result = [];
        try {
            const environment = await EnvService.getEnv();
            let params = {
                entity: entity,
                domain: domain,
                fields: fields,
                lang: (lang.length)?lang:environment.lang,
                order: order,
                sort: sort,
                start: start,
                limit: limit
            };
            const response = await $.get({
                    url: environment.backend_url+'?get=model_collect',
                    dataType: 'json',
                    data: params,
                    contentType: 'application/x-www-form-urlencoded; charset=utf-8'
                })
                .done((event, textStatus, jqXHR) => {
                    this.last_count = parseInt( <any>jqXHR.getResponseHeader('X-Total-Count') );
                });
            result = response;
        }
        catch(response:any) {
            throw response.responseJSON;
        }
        return result;
    }

    /**
     * Search for objects matching the given domain and return a list of identifiers.
     *
     * @param entity
     * @param domain
     * @param order
     * @param sort
     * @param start
     * @param limit
     * @returns
     */
    public async search(entity:string, domain:any[], order:string, sort:string, start:number, limit:number) {
        var result = [];
        try {
            const environment = await EnvService.getEnv();
            let params = {
                entity: entity,
                domain: domain,
                order: order,
                sort: sort,
                start: start,
                limit: limit
            };
            const response = await $.get({
                url: environment.backend_url+'?get=model_search',
                dataType: 'json',
                data: params,
                contentType: 'application/x-www-form-urlencoded; charset=utf-8'
            });
            // response should be an array of ids
            result = response;
        }
        catch(response:any) {
            throw response.responseJSON;
        }
        return result;
    }

}



export default _ApiService;