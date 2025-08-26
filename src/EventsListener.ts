import { $ } from "./jquery-lib";
import { Frame, Context, Domain } from "./equal-lib";

import { UIHelper } from './material-lib';
import { ApiService, EnvService, TranslationService} from "./equal-services";

import moment from 'moment/moment.js';
import 'moment/locale/fr';
import 'moment/locale/nl';
import 'moment/locale/es';

require("../css/material-basics.css");
require("../css/equal.css");

import "../node_modules/quill/dist/quill.core.css";
import "../node_modules/quill/dist/quill.snow.css";

// This project uses MDC library (material design components)
// @see https://github.com/material-components/material-components-web/blob/master/docs/getting-started.md

declare global {
    interface Window {
        context: any;
        beforeUnloadListener: (e:any) => {};
    }

}

/**
 * EqualEventsListener is the root entity for requesting display of View contexts.
 * It acts as a factory facade for relaying event to the Frames they relate to.
 *
 */
class EventsListener {

    // jquery object for components communication (Views and Widgets)
    private $sbEvents:any;

    // map of Frames : mapping DOM selectors with Frame instances
    private frames: any;

    // stack of popups (when forcing opening in popups)
    private popups: any[] = [];

    // User (requested as instantiation of the View). This value can be applied on subsequent Domain objects.
    private user: any = {id: 0};

    // global environment object
    private env: any = {};

    // flag for preventing running callbacks on events
    private mute: boolean = false;

    private subscribers: any = {};

    constructor(domListenerId: string = '') {
        this.frames = {};

        // $sbEvents is a jQuery object used to communicate: it allows both internal services and external lib to connect with eQ-UI

        // if no name was given, use the default one
        if(domListenerId.length == 0) {
            domListenerId = 'eq-listener';
        }
        this.$sbEvents = $('#'+domListenerId);
        // if DOM element by given name cannot be found, create it
        if(!this.$sbEvents.length) {
            this.$sbEvents = $('<div/>').attr('id', domListenerId).css('display','none').appendTo('body');
        }

        // setup event handlers
        this.init(domListenerId);

        /*
        // auto dark mode attempt (doesn't work for dynamic content loaded afterward)
        $(document).ready(function(){
            console.log('ready');
            $(".test_button").on('click', function () {
                console.log('click on button')
                $("html").find('*').each(function(){

                    // extract R G and B from element background color
                    let style = window.getComputedStyle(this);
                    let backgroundColor = (style.backgroundColor).split(',');

                    // R,G,B values are divided by 255 to change the range from 0..255 to 0..1
                    let bg_alpha = (backgroundColor.length < 4)?1.0:parseFloat(backgroundColor[3].split(')')[0]);
                    let bg_red   = bg_alpha * parseFloat(backgroundColor[0].split('(')[1]) / 255;
                    let bg_green = bg_alpha * parseFloat(backgroundColor[1]) / 255;
                    let bg_blue  = bg_alpha * parseFloat(backgroundColor[2].split(')')[0]) / 255;

                    let bg_lightness = (bg_red + bg_green + bg_blue) / 3;

                    let color = (style.color).split(',');
                    let c_alpha = (color.length < 4)?1.0:parseFloat(color[3].split(')')[0]);
                    let c_red   = c_alpha * parseFloat(color[0].split('(')[1]) / 255;
                    let c_green = c_alpha * parseFloat(color[1]) / 255;
                    let c_blue  = c_alpha * parseFloat(color[2].split(')')[0]) / 255;
                    let c_lightness = (c_red + c_green + c_blue) / 3;

                    if(bg_lightness >= 0.6) {
                        $(this).css("background-color", "rgb(30,30,30)");
                    }
                    if(c_lightness <= 0.4) {
                        $(this).css("color", "rgb(250,250,250)");
                    }

                });
            });
        });
        */

    }

    public addSubscriber(events: [], callback: (context:any) => void) {
        for(let event of events) {
            if(!['open', 'close', 'updated', 'navigate'].includes(event)) {
                continue;
            }
            if(!this.subscribers.hasOwnProperty(event)) {
                this.subscribers[event] = [];
            }
            this.subscribers[event].push(callback);
        }
    }

    public navigate(route:string) {
        // run callback of subscribers
        if(this.subscribers.hasOwnProperty('navigate') && this.subscribers['navigate'].length) {
            for(let callback of this.subscribers['navigate']) {
                if( ({}).toString.call(callback) === '[object Function]' && !this.mute) {
                    callback({route: route});
                }
            }
        }
    }

    /**
     * This method is used to generate an Action Button DOM element to be injected in a non-equal App (e.g. Angular native component)
     */
    public async getActionButton(entity: string, view_id: string, domain: any[]) {
        console.debug("EventListener::getActionButton - appending Action button");
        let type = 'list';
        let name = 'default';
        if( view_id.length ) {
            let parts = view_id.split('.');
            if(parts.length) type = <string> parts.shift();
            if(parts.length) name = <string> parts.shift();
        }

        let config:any = {
            entity:     entity,
            type:       type,
            name:       name,
            domain:     domain,
            mode:       'view',
            purpose:    'view'
        };

        // get a unique DOM id
        let id:string = UIHelper.getUuid();
        let target = '#'+id;
        let $container = $('<div></div>').attr('id', id);
        $container.appendTo('body');

        let frame = new Frame(this, target);
        await frame._openContext(config);
        // context has been created and is ready
        let $view_container = frame.getContext().getView().getContainer();
        return $view_container.find('.layout-actions');
    }

    private async _openContext(config: any, reset: boolean = false) {
        console.debug('EventsListener::_openContext');

        if(!config) {
            config = window.context;
        }

        const environment = await EnvService.getEnv();

        // extend default params with received config
        config = {...{
            entity:     '',
            type:       'list',
            name:       'default',
            domain:     [],
            mode:       'view',             // view, edit
            purpose:    'view',             // view, select, add
            lang:       environment.lang,
            locale:     environment.locale,
            callback:   null,
            target:     '#sb-container'
        }, ...config};

        console.debug('EventsListener::_openContext - retrieved context', config, reset, config.entity, config.entity.length);

        // abort invalid entities
        if(!config.entity.length) {
            return ;
        }

        if(this.frames.hasOwnProperty(config.target) && reset) {
            // prevent running callbacks while we close contexts
            this.mute = true;
            // #memo - after closing, the frame is deleted (@see _closeContext())
            await this.frames[config.target].closeAll();
            delete this.frames[config.target];
            // restore callbacks runs
            this.mute = false;
        }

        if(!this.frames.hasOwnProperty(config.target)) {
            this.frames[config.target] = new Frame(this, config.target);
        }

        for(let index in this.frames) {
            this.frames[index].setActive(false);
        }
        this.frames[config.target].setActive(true);

        try {
            await this.frames[config.target]._openContext(config);
            // run callback of subscribers
            if(this.subscribers.hasOwnProperty('open') && this.subscribers['open'].length && !this.mute) {
                for(let callback of this.subscribers['open']) {
                    if( ({}).toString.call(callback) === '[object Function]' ) {
                        callback(config);
                    }
                }
            }
        }
        catch(error) {
            // an error occurred while attempting to open context
        }

    }

    /**
     * Notify subscribers about a context update.
     */
    private async _updatedContext() {
        console.debug('EventsListener::_updatedContext', this.mute);

        // run callback of subscribers
        if(this.subscribers.hasOwnProperty('updated') && this.subscribers['updated'].length && !this.mute) {
            console.debug('eQ::_updatedContext - running callbacks');
            for(let callback of this.subscribers['updated']) {
                if( ({}).toString.call(callback) === '[object Function]') {
                    // run callback with empty context
                    console.debug('calling callback');
                    callback();
                }
            }
        }
    }

    /**
     * Close context non-silently with relayed data
     * @param params
     */
    private async _closeContext(params: any) {

        params = {...{
            target: '#sb-container',
            data:   {},
            silent: false
        }, ...params};

        if(this.frames.hasOwnProperty(params.target)) {
            let frame = this.frames[params.target];
            await frame._closeContext(params.data, params.silent);

            let context = frame.getContext();
            let result = {};
            if(Object.keys(context).length) {
                result = {
                    entity: context.getEntity(),
                    type: context.getType(),
                    name: context.getName(),
                    domain: context.getDomain(),
                    mode: context.getMode(),
                    purpose: context.getPurpose(),
                    lang: context.getLang()
                };
            }

            // run callback of subscribers
            if(this.subscribers.hasOwnProperty('close') && this.subscribers['close'].length && !this.mute && !params.silent) {
                console.debug('eQ::_closeContext - running callbacks', params);
                for(let callback of this.subscribers['close']) {
                    if( ({}).toString.call(callback) === '[object Function]') {
                        // run callback with empty context
                        callback(result);
                    }
                }
            }

            if(!Object.keys(context).length) {
                delete this.frames[params.target];
            }

        }
    }


    /**
     * Close all contexts silently
     */
    private async _closeAll(params: any) {
        if(params && params.hasOwnProperty('target')) {
            if(this.frames.hasOwnProperty(params.target)) {
                await this.frames[params.target]._closeContext(null, params.silent);
            }
        }
        else {
            for(let target of Object.keys(this.frames)) {
                await this.frames[target]._closeContext(null, true);
            }
        }
    }

    /**
     * Asynchronous initialization of the eQ instance.
     *
     */
    private async init(domListenerId: string) {
        console.debug('Initializing EventsListener on ' + domListenerId);
        try {
            // get default (static) config
            this.env = await EnvService.getEnv();
            // attempt to retrieve user
            this.user = await ApiService.getUser();

            if(this.user.hasOwnProperty('language')) {
                // #memo - user.language is a locale
                EnvService.setEnv('locale', this.user.language);
                // #todo @to_confirm
                EnvService.setEnv('lang', this.user.language.slice(0, 2));
                TranslationService.init();
            }

            // attempt to retrieve app config
            /*
            // merged with envinfo
            const settings = await ApiService.getSettings();

            for(let key in settings) {
                EnvService.setEnv(key, settings[key]);
            }
            */
        }
        catch(err) {
            console.warn('unable to retrieve user info, fallback to guest');
        }

        const environment = await EnvService.getEnv();

        // init locale (fallback to en)
        console.debug('Setting locale', environment.locale);
        // #memo - this is necessary because by default moment switches to the latest imported locale file
        moment.locale('en');

        if(environment.locale != 'en') {
            // #memo - this is the full list of locales for which a related moment locale `.js` file exists.
            // var valid_locales = ['af','ar-dz','ar-kw','ar-ly','ar-ma','ar-sa','ar-tn','ar','az','be','bg','bm','bn','bo','br','bs','ca','cs','cv','cy','da','de-at','de-ch','de','dv','el','en-au','en-ca','en-gb','en-ie','en-il','en-nz','en-SG','eo','es-do','es-us','es','et','eu','fa','fi','fo','fr-ca','fr-ch','fr','fy','ga','gd','gl','gom-latn','gu','he','hi','hr','hu','hy-am','id','is','it-ch','it','ja','jv','ka','kk','km','kn','ko','ku','ky','lb','lo','lt','lv','me','mi','mk','ml','mn','mr','ms-my','ms','mt','my','nb','ne','nl-be','nl','nn','pa-in','pl','pt-br','pt','ro','ru','sd','se','si','sk','sl','sq','sr-cyrl','sr','ss','sv','sw','ta','te','tet','tg','th','tl-ph','tlh','tr','tzl','tzm-latn','tzm','ug-cn','uk','ur','uz-latn','uz','vi','x-pseudo','yo','zh-cn','zh-hk','zh-tw'];

            const accepted_locales = ['fr', 'nl', 'es'];

            if(accepted_locales.indexOf(environment.locale) > -1) {
                if(moment.locale(environment.locale) == environment.locale) {
                    console.debug('Locale set to '+environment.locale);
                }
                else {
                    console.warn('Unable to load requested locale');
                }
            }
            else {
                console.debug('Invalid locale requested: ignoring');
            }
        }

        // overload environment lang if set in URL
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);

        if(urlParams.has('lang')) {
            // #todo - remove ?
            environment.lang = <string> urlParams.get('lang');
            EnvService.setEnv('lang', <string> urlParams.get('lang'));
        }

        /**
         *
         * A new context can be requested by ngx (menu or app) or by opening a sub-object
         */
        this.$sbEvents.on('_openContext', async (event:any, config:any, reset: boolean = false) => {
            console.debug('EventsListener: received _openContext', event, config, reset);
            this._openContext(config, reset);
        });


        /**
         *
         * Event handler for request for closing current context
         * When closing, a context might transmit some value (its the case, for instance, when selecting one or more records for m2m or o2m fields)
         */
        this.$sbEvents.on('_closeContext', (event:any, params:any = {}) => {
            this._closeContext(params);
        });

        this.$sbEvents.on('_closeAll', (event:any, params:any = {}) => {
            this._closeAll(params);
        });

        // create a static callback to make it available to any class through global window object
        // callback can be registered (`window.addEventListener('beforeunload', window.beforeUnloadListener);`) or unregistered (`window.removeEventListener('beforeunload', window.beforeUnloadListener);`)
        window.beforeUnloadListener = (e:any) => {
            e.preventDefault();
            return (e.returnValue = 'There are unsaved changes pending.');
        };
    }

    /**
     * Mark current context as changed (called from Frame class).
     */
    public async updated() {
        console.debug('EventsListener::updated');
        await this._updatedContext();
    }

    public async closeAll(external:boolean=false) {
        console.debug('eQ:received closeAll', external);
        // for requests from the outside, check for current changes before closing all context
        if(external) {
            for(let index in this.frames) {
                let frame = this.frames[index];
                if(frame && typeof frame.getContext().getView === 'function' && frame.getContext().getView().hasChanged()) {
                    let validation = confirm(TranslationService.instant('SB_ACTIONS_MESSAGE_ABANDON_CHANGE'));
                    if(!validation) {
                        return false;
                    }
                    else {
                        break;
                    }
                }
            }
        }
        this.$sbEvents.trigger('_closeAll');
        await this._closeAll({});
        return true;
    }

    /**
     * Close a context (can be invoked either from outside, or from Frame class).
     */
    public async close(params:any) {
        await this._closeContext(params);
    }

    /**
     * Interface method for integration with external tools.
     * @param context
     * @param external      Indicates if the request comes from the outside (not from the current Frame context stack).
     */
    public async open(context: any, external: boolean = false) {
        console.debug("EventsListener::open", context, external);

        // opening a context from the outside implies closing some contexts: check for current changes before doing so
        if(external) {
            for(let index in this.frames) {
                let frame = this.frames[index];
                if(frame && typeof frame.getContext().getView === 'function' && frame.getContext().getView().hasChanged()) {
                    let validation = confirm(TranslationService.instant('SB_ACTIONS_MESSAGE_ABANDON_CHANGE'));
                    if(!validation) {
                        return false;
                    }
                    else {
                        break;
                    }
                }
            }
        }

        const environment = await EnvService.getEnv();

        // extend default params with received config
        let target_context = {...{
            entity:     '',
            type:       'list',
            name:       'default',
            domain:     [],
            mode:       'view',             // view, edit
            purpose:    'view',             // view, select, add
            lang:       environment.lang,
            callback:   null,
            target:     '#sb-container',
            reset:      false
        }, ...context};

        // this.$sbEvents.trigger('click', [context, context.hasOwnProperty('reset') && context.reset]);

        if( context.hasOwnProperty('view') ) {
            let parts = context.view.split('.');
            let view_type = 'list', view_name = 'default';
            if(parts.length) {
                view_type = <string>parts.shift();
            }
            if(parts.length) {
                view_name = <string>parts.shift();
            }
            if(!context.hasOwnProperty('type')) {
                target_context.type = view_type;
            }
            if(!context.hasOwnProperty('name')) {
                target_context.name = view_name;
            }
        }

        // make context available to the outside
        window.context = target_context;
        // ContextService uses 'window' global object to store the arguments (context parameters)
        // this.$sbEvents.trigger('_openContext', [target_context, target_context.reset]);
        await this._openContext(target_context, target_context.reset);

        return true;
    }

    /**
     * Open the requested context inside a new popup (no target container required).
     *
     * @param config
     */
    public async popup(config: any, domContainerSelector: string = 'body') {
        console.debug('EventsListener::popup', config);

        let $domContainer  = $(domContainerSelector);

        let $wrapper = $domContainer.find('.sb-popup-wrapper');
        if(!$wrapper.length) {
            // origin not found, create container
            $wrapper = $('<div class="sb-popup-wrapper"></div>')
            $wrapper.css('left', window.pageXOffset+'px');
            $wrapper.css('top', window.pageYOffset+'px');
            $domContainer.append($wrapper);
        }

        let popup_id = this.popups.length + 1;
        let $popup = $('<div id="sb-popup-'+popup_id+'" class="sb-popup"></div>');
        $wrapper.append($popup);
        $popup.css('z-index', 9000 + popup_id);

        let $inner = $('<div class="sb-popup-inner" id="sb-popup-inner-'+popup_id+'"></div>').on('_close', () => {
            $popup.remove();
        });

        $popup.append($inner);

        let frame = new Frame(this, '#sb-popup-inner-'+popup_id);

        config.display_mode = 'popup';
        await frame._openContext(config);

        this.popups.push(frame);
    }

    public async popup_close(params: any) {
        let frame = this.popups.pop();

        let $wrapper = $('body').find('.sb-popup-wrapper');
        // pop last child of wrapper
        $wrapper.find('.sb-popup').last().remove();
        // if there are no popup left, remove wrapper
        if(!this.popups.length) {
            $wrapper.remove();
        }
        // close context (update frame header if necessary)
        await frame._closeContext(params.data);
    }

    public getUser() {
        return this.user;
    }

    public getEnv() {
        return this.env;
    }

    /**
     * Return global instance of the API service, for using by external tools.
     */
    public getApiService() {
        return ApiService;
    }

    public getTranslationService() {
        return TranslationService;
    }

    /**
     * Generates a menu to be displayed inside the #sb-menu container.
     * Items of the menu trigger _openContext calls, independently from any existing listener
     *
     * @param menu Menu object (JSON structure) describing the entries of each section.
     */
    public loadMenu(menu: any) {
        // #todo - this is meant for testing and should be deprecated
        for(var i = 0; i < menu.length; ++i) {
            var item = menu[i];

            let $link = $('<div/>').addClass('sb-menu-button mdc-menu-surface--anchor')
            .append( UIHelper.createButton('menu-entry'+'-'+item.name+'-'+item.target, item.name, 'text', item.icon) )
            .appendTo($('#sb-menu'));

            // create floating menu for filters selection
            let $menu = UIHelper.createMenu('nav-menu').addClass('sb-view-header-list-filters-menu').css({"margin-top": '48px'}).appendTo($link);
            let $list = UIHelper.createList('nav-list').appendTo($menu);

            for(var j = 0; j < menu[i].children.length; ++j) {
                var item = menu[i].children[j];

                UIHelper.createListItem('menu_item-'+i+'-'+j, item.name + ' (' + item.entity + ')', item.icon)
                .data('item', item)
                .appendTo($list)
                .on('click', (event) => {
                    let $this = $(event.currentTarget);
                    let item = $this.data('item');
                    if( !item.hasOwnProperty('domain') ) {
                        item.domain = [];
                    }
                    let type = 'list';
                    let name = 'default';
                    if( item.hasOwnProperty('target') ) {
                        let parts = item.target.split('.');
                        if(parts.length) type = <string>parts.shift();
                        if(parts.length) name = <string>parts.shift();
                    }
                    this.$sbEvents.trigger('_closeAll');
                    setTimeout(() => {
                        this.$sbEvents.trigger('_openContext', {entity: item.entity, type: type, name: name, domain: item.domain} );
                    });
                });
            }

            UIHelper.decorateMenu($menu);
            $link.find('button').on('click', () => $menu.trigger('_toggle') );
        }

    }
}

module.exports = EventsListener;