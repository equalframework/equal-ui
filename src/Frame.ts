import { $ } from "./jquery-lib";

import { Context, Domain } from "./equal-lib";
import { ApiService, EnvService, TranslationService } from "./equal-services";
import { UIHelper } from './material-lib';

/**
 * Frames handle a stack of contexts
 * and are in charge of their header and lang switcher.
 *
 */
export class Frame {

    private eq: any;

    private environment: any = null;
    private languages: any = {};

    private $headerContainer: any;

    // temporary var for computing width of rendered strings
    private $canvas: any;

    // stack of Context (only current context is visible)
    private stack: Array<Context>;

    // root context
    private context: Context;

    // DOM selector of the element to which current Frame relates
    private domContainerSelector: string;

    // interaction mode ('stacked' or 'popup')
    private display_mode: string;

    // allow to force showing close button in any context
    private close_button: boolean;

    // full URL of the page the frame is displayed on
    private url: string;

    private allow_history_change: boolean = true;

    private is_active: boolean;

    constructor(eq:any, domContainerSelector:string='#sb-container') {
        this.eq = eq;
        this.context = <Context> {};
        this.stack = [];
        this.is_active = true;
        // default mode : contexts are displayed in the same container
        this.display_mode = 'stacked';
        // if there is a single context, prevent closing the frame
        this.close_button = false;
        // As a convention, DOM element referenced by given selector must be present in the document.
        this.domContainerSelector = domContainerSelector;
        this.url = window.location.href;
        this.init();
    }

    public setActive(active: boolean) {
        this.is_active = active;
    }

    public isActive() {
        return this.is_active;
    }

    public getContext() {
        return this.context;
    }

    public getParentContext(offset:number = -1) {
        let len = this.stack.length;
        let pos = len - Math.abs(offset);
        if(pos >= 0) {
            return this.stack[pos];
        }
        // #memo - if stack is empty, current context is an empty object
        return this.context;
    }

    public getEnv() {
        return this.environment;
    }

    private async init() {
        this.environment = await EnvService.getEnv();

        // get list of available languages for Models
        const languages = await ApiService.collect('core\\Lang', [], ['id', 'code', 'name'], 'name', 'asc', 0, 100, this.environment.lang);

        for(let lang of languages) {
            this.languages[lang.code] = lang.name;
        }

        // trigger header re-draw when available horizontal space changes
        var resize_debounce:any;
        $(window).on('resize', () => {
            clearTimeout(resize_debounce);
            resize_debounce = setTimeout( async () => this.updateHeader(), 100);
        });


        $(window).on('keydown', (e) => {
            if(this.is_active) {
                let key: any = null;
                if((e.ctrlKey || e.metaKey) && e.key === 's') {
                    key = 'ctrl_s';
                }
                else if(e.key === 'Escape') {
                    key = 'esc';
                }
                if(key && typeof this.context.keyboardAction === 'function') {
                    // prevent default behavior (i.e. opening 'save-as' dialog)
                    e.preventDefault();
                    // relay to current context
                    this.context.keyboardAction(key);
                }
            }
        });

        // #memo - there is no way to prevent popstate if there is non-saved content (since it doesn't trigger `beforeunload`event)
        window.addEventListener('popstate', async (event:any) => {
            if(this.display_mode != 'stacked') {
                return;
            }
            console.log('Frame::popstate', event, event?.state, this.stack);
            if (this.stack.length > 0 && event.state && event.state.hasOwnProperty ('is_eq')) {
                // consider only history from this frame
                if(event.state.url != this.url) {
                    return;
                }
                // #todo - pass a flag as param instead of this workaround (we need that info to prevent re-pushing contexts to history #memo - we cannot pass it through config)
                this.allow_history_change = false;

                // build old (current) contexts stack
                let current_stack = [];
                for(let j = 1; j < this.stack.length; ++j) {
                    current_stack.push(this.stack[j]);
                }
                current_stack.push(this.context);
                // retrieved popped stack
                let new_stack = event.state.stack;
                // pass-1 ignore identical contexts
                let min = Math.min(new_stack.length, current_stack.length);
                let start = 0;
                for(; start < min; ++start) {
                    if(JSON.stringify(new_stack[start]) != JSON.stringify(current_stack[start].getConfig(true))) {
                        break;
                    }
                }
                // pass-2 close contexts in old stack
                for(let i = current_stack.length; i > start; --i) {
                    await this.closeContext();
                }
                // pass-3 open new contexts
                for(let i = start, n = new_stack.length; i < n; ++i) {
                    await this.openContext(new_stack[i]);
                }
                this.allow_history_change = true;
            }
        });
    }

    /**
     * Push the current stack of contexts to the browser history.
     * `allow_history_change` is used to prevent pushing contexts to history when handling popstate event.
     *
     * #memo - when a callback is present, the context config cannot be cloned, so we void callback when present
     */
    private pushState() {
        if(this.allow_history_change && this.display_mode == 'stacked') {
            let state = {
                    is_eq: true,
                    url: this.url,
                    stack: <any>[]
                };
            // push list of config for context currently in the local stack
            for(let i = 1, n = this.stack.length; i < n; ++i) {
                let ctx = <Context> this.stack[i];
                state.stack.push(ctx.getConfig(true));
            }
            // push current context
            if(this.context && typeof this.context.getConfig === 'function') {
                state.stack.push(this.context.getConfig(true));
                window.history.pushState(state, '');
                console.log('Frame::pushing state', state);
            }
        }
    }

    private getTextWidth(text: string, $elem: JQuery) {
        console.debug('getTextWidth::computing width', text, $elem);
        if (!$elem || !$elem.length) {
            return 0;
        }

        $elem.empty()
            .css({
                position: 'absolute',
                visibility: 'hidden',
                whiteSpace: 'nowrap',
                display: 'inline-block',
                width: 'auto'
            })
            .html(text);

        return $elem[0].clientWidth || $elem[0].offsetWidth;
    }

    private async getPurposeString(context: Context) {
        let result: string = '';

        let entity = context.getEntity();
        let type = context.getType();
        let name = context.getName();
        let purpose = context.getPurpose();

        let view_schema = await ApiService.getView(entity, type+'.'+name);
        // get translation from currently selected lang
        let translation = await ApiService.getTranslation(entity);

        if(translation.hasOwnProperty('name')) {
            entity = translation['name'];
        }
        else if(view_schema.hasOwnProperty('name')) {
            entity = view_schema['name'];
        }
        else {
            let parts = entity.split('\\');
            entity = <string>parts.pop();
            // set the first letter uppercase
            entity = entity.charAt(0).toUpperCase() + entity.slice(1);
        }

        if(purpose == 'view') {
            result = entity;
            if(type == 'list') {
                if(translation.hasOwnProperty('plural')) {
                    result = translation['plural'];
                }
            }
            // if view_id is defined in translation file : use its translated values, if present
            if(translation.hasOwnProperty('view')) {
                let view_id = context.getView().getId();
                if(translation.view.hasOwnProperty(view_id) && translation.view[view_id].hasOwnProperty('name')) {
                    result = translation.view[view_id].name;
                }
            }
        }
        else {
            // i18n: look in config translation file
            let purpose_const: string = '';
            switch(purpose) {
                case 'create':  purpose_const = 'SB_PURPOSE_CREATE'; break;
                case 'update':  purpose_const = 'SB_PURPOSE_UPDATE'; break;
                case 'select':  purpose_const = 'SB_PURPOSE_SELECT'; break;
                case 'add':     purpose_const = 'SB_PURPOSE_ADD'; break;
            }
            let translated_purpose = await TranslationService.translate(purpose_const);
            if(translated_purpose.length) {
                result = translated_purpose + ' ' + entity;
            }
            else {
                result = purpose.charAt(0).toUpperCase() + purpose.slice(1) + ' ' + entity;
            }
        }
        // when context relates to a single object, append object identifier to the breadcrumb
        if(type == 'form') {
            let objects = await context.getView().getModel().get();
            if(objects.length) {
                let object = objects[0];
                result += ' <small>[';
                if (
                    purpose !== 'create' &&
                    typeof object.name === 'string' &&
                    object.name.trim() !== '' &&
                    object.name !== 'null' &&
                    object.name !== String(object.id)
                ) {
                    // escape HTML and limit name length
                    let name = $('<a>' + object['name' ] + '</a>').text().substring(0, 25);
                    result +=  name + ' - ';
                }
                result += object['id'];
                result += ']</small>';
            }
        }

        return result;
    }

    private showLoader() {
        let $domContainer = $(this.domContainerSelector);

        if(!$domContainer) {
            return;
        }

        // instantiate header upon first call
        let $loader = $domContainer.find('.sb-container-loader-overlay');
        if($loader.length == 0) {
            $loader = $('<div/>').addClass('sb-container-loader-overlay').prependTo($domContainer);
            $loader.append($('<div/>').addClass('loader-container').append($('<div/>').addClass('loader-spinner')));
        }

        $loader.show();
    }

    private hideLoader() {
        let $domContainer = $(this.domContainerSelector);

        if(!$domContainer) {
            return;
        }

        // instantiate header upon first call
        let $loader = $domContainer.find('.sb-container-loader-overlay');
        if($loader.length) {
            $loader.hide();
        }

    }

    /**
     * Refresh the header breadcrumb, according to available space.
     * .sb-container-header is managed automatically and shows the breadcrumb of the stack
     *
     * @returns
     */
    private async updateHeader(config:any={}) {
        console.debug('Frame::updateHeader()');

        let $domContainer = $(this.domContainerSelector);

        if(!$domContainer) {
            return;
        }

        // instantiate header upon first call
        this.$headerContainer = $domContainer.find('.sb-container-header');
        if(this.$headerContainer.length == 0) {
            this.$headerContainer = $('<div/>').addClass('sb-container-header').prependTo($domContainer);
        }

        if( this.stack.length == 0 || !this.context.hasOwnProperty('$container')) {
            // hide header if there is no context
            this.$headerContainer.empty().hide();
            return;
        }

        // make sure header is visible
        this.$headerContainer.show();

        let $elem = $('<h3 />');

        // add temporary, invisible header for font size computations
        let $temp = $('<h3 />').css({visibility: 'hidden'}).appendTo(this.$headerContainer);

        let current_purpose_string = await this.getPurposeString(this.context);

        let available_width = (this.$headerContainer.length && this.$headerContainer[0]) ? (this.$headerContainer[0].clientWidth - 160) : 300;

        let total_text_width = this.getTextWidth(current_purpose_string, $temp);

        let prepend_contexts_count = 0;

        if(total_text_width > available_width) {
            let char_width = (total_text_width / current_purpose_string.length) + 2;
            let max_chars = available_width / char_width;
            current_purpose_string = current_purpose_string.substring(0, max_chars-1) + '…';
        }
        else {
            // use all contexts in stack (loop in reverse order)
            for(let i = this.stack.length-1; i >= 0; --i) {
                let context = this.stack[i];
                if(context.hasOwnProperty('$container')) {
                    let context_purpose_string = await this.getPurposeString(context);

                    let text_width = this.getTextWidth(context_purpose_string + ' > ', $temp) + 20;
                    let overflow = false;
                    if( (text_width+total_text_width) >= available_width) {
                        overflow = true;
                        context_purpose_string = '...';
                        text_width = this.getTextWidth(context_purpose_string + ' > ', $temp) + 20;
                        if(text_width+total_text_width >= available_width) {
                            break;
                        }
                    }
                    total_text_width += text_width;
                    prepend_contexts_count++;

                    if(!config.hasOwnProperty('header_links') || config.header_links == true) {
                        let $crumb = $('<a>'+context_purpose_string+'</a>').prependTo($elem)
                        .on('click', async () => {
                            // close all contexts after the one clicked
                            for(let j = this.stack.length-1; j > i; --j) {
                                // unstack contexts silently (except for the targeted one), and ask for validation at each step
                                if(this.context.getView().hasChanged()) {
                                    let validation = confirm(TranslationService.instant('SB_ACTIONS_MESSAGE_ABANDON_CHANGE'));
                                    if(!validation) {
                                        return;
                                    }
                                    this.closeContext(null, true);
                                }
                                else {
                                    this.closeContext(null, true);
                                }
                            }
                            this.closeContext();
                        });
                        this.decorateCrumb($crumb, context);
                    }
                    else {
                        let $crumb = $('<span>'+context_purpose_string+'</span>').prependTo($elem);
                        this.decorateCrumb($crumb, context);
                    }

                    if(overflow) {
                        break;
                    }

                    if(i > 1) {
                        $('<span> › </span>').css({'margin': '0 10px'}).prependTo($elem);
                    }

                }
            }

        }

        // ... and add the active context

        if(prepend_contexts_count > 0) {
            $('<span> › </span>').css({'margin': '0 10px'}).appendTo($elem);
        }

        if(this.display_mode == 'popup' && (!config.hasOwnProperty('header_links') || config.header_links == true)) {
            let model_schema = await ApiService.getSchema(this.context.getEntity());
            let objects:any = await this.context.getView().getModel().get();
            if(objects.length && objects[0].hasOwnProperty('id')) {
                let url = model_schema.link.replace(/object\.id/, objects[0].id);
                let $crumb = $('<a>'+current_purpose_string+'</a>').attr('href', url).attr('target', '_blank').prependTo($elem);
                this.decorateCrumb($crumb, this.context);
            }
        }
        else {
            let $crumb = $('<span>'+current_purpose_string+'</span>').appendTo($elem);
            this.decorateCrumb($crumb, this.context);
        }

        if(this.stack.length > 1 || this.display_mode == 'popup' || this.close_button) {
            // #memo - for integration, we need to let user close any context
            UIHelper.createButton('context-close', '', 'mini-fab', 'close')
                .addClass('context-close')
                .appendTo($elem)
                .on('click', () => {
                    let validation = true;
                    if(Object.keys(this.context).length && this.context.getView().hasChanged()) {
                        validation = confirm(TranslationService.instant('SB_ACTIONS_MESSAGE_ABANDON_CHANGE'));
                    }
                    if(!validation) {
                        return;
                    }
                    this.closeContext();
                });
        }

        // lang selector controls the current context and is used for opening subsequent contexts
        const environment = await EnvService.getEnv();

        // #todo - add support for lang with locale (format xx_XX)
        let lang = environment.lang.slice(0, 2);

        // if there is a current context, use its lang
        if(this.context.hasOwnProperty('$container')) {
            lang = this.context.getLang();
        }

        let $lang_selector = UIHelper.createSelect('lang-selector_' + Math.random().toString(36).substring(2, 10), '', this.languages, lang);
        $lang_selector.addClass('lang-selector');
        $lang_selector.find('.mdc-menu').addClass('mdc-menu-surface--is-open-left');
        $lang_selector.find('.mdc-select__selected-text').css({'text-transform': 'uppercase'}).text(lang);

        // when the lang selector is changed by user, update current context
        $lang_selector.find('input').on('change', () => {
            let lang:string = <string> $lang_selector.find('input').val();
            $lang_selector.trigger('select', lang);
            // force display lang code instead of full lang name (UI/UX)
            setTimeout( () => {
                    $lang_selector.find('.mdc-select__selected-text').css({'text-transform': 'uppercase'}).text(lang);
                }, 100);
            let context: Context = new Context(this, this.context.getEntity(), this.context.getType(), this.context.getName(), this.context.getDomain(), this.context.getMode(), this.context.getPurpose(), lang, this.context.getCallback(), this.context.getConfig());
            this.context.destroy();
            this.context = context;
            this.context.isReady().then( () => {
                $(this.domContainerSelector).append(this.context.getContainer());
            });
            console.debug('Switched ORM requests to "'+lang+'"');
        });

        this.$headerContainer.show().empty().append($elem).append($lang_selector);
    }

    /**
     * Adds hover listener on a part of the header breadcrumb, in order to display a popup showing the details about the view of a given context.
     *
     * @param $crumb
     * @param context
     */
    private decorateCrumb($crumb: JQuery, context: Context) {
        $crumb.on('mouseenter', () => {
            $crumb.addClass('has-mouseover');
            // hide any previously opened popup in the header
            this.$headerContainer.find('.header-view-details-popup')
                .not($crumb.find('.header-view-details-popup'))
                .removeClass('has-mouseover').hide();
            setTimeout( () => {
                // show popup if crumb sill has mouseover after a delay
                if($crumb.hasClass('has-mouseover')) {
                    $crumb.find('.header-view-details-popup').show();
                }
            }, 1200);
        })
        .on('mouseleave', () => {
            $crumb.removeClass('has-mouseover');
            setTimeout( () => {
                let $popup = $crumb.find('.header-view-details-popup');
                // hide popup if neither crumb nor popup has mouseover
                if(!$crumb.hasClass('has-mouseover') && !$popup.hasClass('has-mouseover')) {
                    $popup.hide();
                }
            }, 500);
        });

        $('<div />').addClass('header-view-details-popup').hide()
            .append( $('<div />').addClass('header-view-details-title')
                .text('View details')
                .append(
                    $('<span class="btn-copy material-icons">content_copy</span>')
                    .on('click', () => {
                        console.log('copying to clipboard');
                        let tmp = document.createElement("textarea");
                        tmp.style.position = 'absolute';
                        tmp.style.left = '-9999px';
                        document.body.appendChild(tmp);
                        tmp.value = context.getEntity() + '.' + context.getType() + '.' + context.getName();
                        tmp.select();
                        document.execCommand("copy");
                        document.body.removeChild(tmp);
                    })
                 )
            )
            .append( $('<div />').addClass('header-view-details-body')
                .append( $('<div />').attr('title', context.getEntity()).html('Entity: <b>'+context.getEntity()+'</b>') )
                .append( $('<div />').attr('title', context.getType()+'.'+context.getName()).html('View: <b>'+context.getType()+'.'+context.getName()+'</b>') )
                .append( $('<div />').attr('title', context.getPurpose()).html('Purpose: <b>'+context.getPurpose()+'</b>') )
                .append( $('<div />').attr('title', context.getMode()).html('Mode: <b>'+context.getMode()+'</b>') )
            )
            .on('mouseenter', function() {
                $crumb.find('.header-view-details-popup').addClass('has-mouseover');
            })
            .on('mouseleave', function() {
                let $popup = $crumb.find('.header-view-details-popup');
                $popup.removeClass('has-mouseover');
                setTimeout( () => {
                    // hide popup if neither crumb nor popup has mouseover
                    if(!$crumb.hasClass('has-mouseover') && !$popup.hasClass('has-mouseover')) {
                        $popup.hide();
                    }
                }, 500);
            })
            .appendTo($crumb);
    }

    /**
     * Generate an object mapping fields of current entity with default values, based on current domain.
     * #todo - use Model class (@see `Model::getModelDefaults()`)
     *
     * @returns Object  A map of fields with their related default values
     */
     private async getNewObjectDefaults(entity: string, domain: [] = []) {
        // create a new object as draft
        let fields: any = {state: 'draft'};
        // retrieve fields definition
        let model_schema = await ApiService.getSchema(entity);
        let model_fields = model_schema.fields;
        // use View domain for setting default values
        let tmpDomain = new Domain(domain);
        for(let clause of tmpDomain.getClauses()) {
            for(let condition of clause.getConditions()) {
                let field  = condition.getOperand();
                if(field == 'id' || field == 'name' || field == 'status') {
                    continue;
                }
                if(['ilike', 'like', '=', 'is'].includes(condition.getOperator()) && model_fields.hasOwnProperty(field)) {
                    fields[field] = condition.getValue();
                }
            }
        }
        return fields;
    }

    public getUser() {
        return this.eq.getUser();
    }

    public async updatedContext(updated: any = {}) {
        console.debug('Frame::updatedContext');
        await this.eq.updated(updated);
        this.updateHeader();
    }

    /**
     * This method can be called by any child or sub-child (view, layout, widgets) (bottom-up).
     *
     * @param context
     */
    public async openContext(context: any) {
        context.target = this.domContainerSelector;
        // we use eventlistener :: open() method in order to relay the context change to the outside

        if(this.display_mode == 'stacked') {
            await this.eq.open(context);
        }
        else if(this.display_mode == 'popup') {
            await this.eq.popup(context);
        }
    }

    /**
     * @param data
     * @param silent
     */
    public async closeContext(data:any = null, silent: boolean = false) {
        if(this.display_mode == 'stacked') {
            await this.eq.close({
                target: this.domContainerSelector,
                data:   data,
                silent: silent
            });
        }
        else if(this.display_mode == 'popup') {
            await this.eq.popup_close({
                data:   data,
            });
        }
    }

    /**
     * Instantiate a new context and push it on the contexts stack (top-down).
     *
     * This method is meant to be called by the eventListener only (eQ object).
     *
     * @param config
     */
    public async _openContext(config: any) {
        console.debug('Frame::_openContext', config);

        this.showLoader();

        try {
            const environment = await EnvService.getEnv();
            // extend default params with received config
            config = {...{
                entity:     '',
                type:       'list',
                name:       'default',
                domain:     [],
                mode:       'view',             // view, edit
                purpose:    'view',             // view, select, add, create
                lang:       environment.lang,
                locale:     environment.locale,
                callback:   null
            }, ...config};

            if(config.hasOwnProperty('display_mode')) {
                this.display_mode = config.display_mode;
            }

            if(config.hasOwnProperty('close_button')) {
                this.close_button = config.close_button;
            }

            // if there is a current context, use its lang for the new context
            if(this.context.hasOwnProperty('$container')) {
                config.lang = this.context.getLang();
            }

            // force consistency between mode and purpose
            if(['create', 'update'].indexOf(config.purpose) > -1) {
                config.mode = 'edit';
            }

            // create a draft object if required: Edition is based on asynchronous creation:
            //   a draft is created (or recycled) and will be turned into an instance if 'update' action is triggered within view.
            if(config.purpose == 'create') {
                try {
                    console.debug('requesting draft object');
                    let defaults    = await this.getNewObjectDefaults(config.entity, config.domain);
                    let object      = await ApiService.create(config.entity, defaults);
                    config.domain   = [ ['id', '=', object.id] ];
                }
                catch(response) {
                    console.warn('unable to create object', response);
                    throw response;
                }
            }

            let context: Context = new Context(this, config.entity, config.type, config.name, config.domain, config.mode, config.purpose, config.lang, config.callback, config);

            // stack current (previous) context
            this.stack.push(this.context);

            this.context = context;

            // push new state to local history
            // #memo - 'allow_history_change' is used to ignore calls resulting from popstate handler
            this.pushState();

            try {
                await this.context.isReady();
                console.debug('context ready');

                for(let ctx of this.stack) {
                    if(ctx && typeof ctx.getContainer === 'function') {
                        // containers are hidden and not detached in order to maintain the listeners
                        ctx.getContainer().hide();
                    }
                }
                $(this.domContainerSelector).append(this.context.getContainer());
                // relay event to the outside
                $(this.domContainerSelector).show().trigger('_open', [{context: config}]);
                this.updateHeader(config);
            }
            catch(error) {
                console.warn('unexpected error while waiting for context readiness', error);
                throw error;
            }
        }
        catch(error) {
            console.warn('unexpected error', error);
        }

        this.hideLoader();
    }

    public async closeAll() {
        // close all contexts silently
        while(this.stack.length) {
            await this.closeContext(null, true);
        }

        console.debug("Frame::closeAll - closed all contexts", this.context, this.stack);
    };

    /**
     * Handler for request for closing current context (top of stack).
     * When closing, a context might transmit some value (its the case, for instance, when selecting one or more records for m2m or o2m fields).
     *
     * This method is meant to be called by the eventListener only (eQ object).
     *
     * @param silent    If set to true, we do not show the pop-ed context and we do not refresh the header.
     */
    public async _closeContext(data:any = null, silent: boolean = false) {

        if(this.stack.length) {
            if(this.context.hasChanged()) {
                // mark all contexts in the stack as changed
                for(let ctx of this.stack) {
                    if(ctx.hasOwnProperty('$container')) {
                        ctx.setChanged();
                    }
                }
            }

            // destroy current context and run callback, if any
            this.context.close({silent: silent, ...data});

            // restore previous context
            this.context = <Context>this.stack.pop();

            if(!silent) {
                if( this.context && this.context.hasOwnProperty('$container') ) {
                    // #memo - if we refresh in edit mode, we risk losing data (fields previously set and not saved + `data` arg)
                    if(this.context.hasChanged() && this.context.getMode() == 'view') {
                        await this.context.refresh();
                    }

                    this.context.$container.show();
                }
                this.updateHeader();

                // push new state to local history
                this.pushState();
            }

            // if we closed the latest Context from the stack, relay data to the outside
            // #todo - is this still necessary ? (since we run callbacks in eventlisteners)
            if(!this.stack.length) {
                // console.debug('Frame::_closeContext - stack empty, closing');
                // $(this.domContainerSelector).hide().trigger('_close', [ data ]);
            }
        }
    }

    public getDomContainer() {
        return $(this.domContainerSelector);
    }

}

export default Frame;