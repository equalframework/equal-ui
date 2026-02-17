import { $, jqlocale } from "./jquery-lib";
import { UIHelper } from './material-lib';

import { ApiService, TranslationService } from "./equal-services";
import { Context, Layout, Model, Domain } from "./equal-lib";
import { Widget, WidgetFactory } from "./equal-widgets";
import { LayoutFactory } from "./equal-layouts";
import { Clause, Reference } from "./Domain";

import { saveAs } from 'file-saver';
export class View {
    static readonly DEFAULT_CONTROLLER: string = 'model_collect';
    static readonly DEFAULT_ORDER: string = 'id';
    static readonly DEFAULT_SORT: string = 'asc';
    static readonly DEFAULT_START: number = 0;
    static readonly DEFAULT_LIMIT: number = 25;
    static readonly DEFAULT_GROUP_BY: string[] = [];

    private uuid: string;

    private context: Context;

    public entity: string;
    public type: string;
    public name: string;

    // Mode under which the view is to be displayed ('view' [default], or 'edit')
    public mode: string;
    // Purpose for which the view is to be displayed (this impacts the action buttons in the header)
    public purpose: string;

    // View holds the params for search requests performed by Model
    public domain: any[];
    private order: string;
    private sort: string;
    private start: number;
    private limit: number;
    private group_by: any[];

    private controller: string;
    // associative array mapping additional params with their values (relayed to controller)
    private params: any;

    public  lang: string;

    private layout: Layout;
    private model: Model;

    private translation: any;
    private view_schema: any;
    private model_schema: any;

    // Map of fields mapping their View definitions
    private view_fields: any;
    // Map of fields mapping their Model definitions
    private model_fields: any;
    // Map of available filters from View definition mapping filters id with their definition
    private filters: any;
    // Map of available custom exports with their definition
    private exports: any;

    // Custom actions of the view
    private custom_actions: any;

    // Config object for setting display of list controls and action buttons
    private config: any;

    // List of currently selected filters from View definition (for filterable types)
    private applied_filters_ids: any[];

    // When type is list, one or more objects might be selected
    private selected_ids: any[];

    private subscribers: any = {};

    private is_ready_promise: any;
    private is_inline_editing: boolean = false;

    // for list views, keep track of the active object/row
    private activeObjectId: number = 0;

    public $container: any;

    public $headerContainer: any;
    public $layoutContainer: any;
    public $footerContainer: any;


    /**
     *
     * @param entity    entity (package\Class) to be loaded: should be set only once (depend on the related view)
     * @param type      type of the view ('list', 'form', ...)
     * @param name      name of the view (eg. 'default')
     * @param domain    Array of conditions (disjunctions clauses of conjunctions conditions): predefined domain from the Context.
     * @param mode      ('view', 'edit')
     * @param purpose   ('view', 'select', 'add', 'create', 'update', 'widget')
     * @param lang
     * @param config    extra parameters related to contexts communications
     */
    constructor(context: Context, entity: string, type: string, name: string, domain: any[], mode: string, purpose: string, lang: string, config: any = null) {
        // generate a random UUID
        this.uuid = UIHelper.getUuid();
        this.params = {};
        this.context = context;
        this.entity = entity;
        this.type = type;
        this.name = name;
        this.domain = domain;
        this.mode = mode;
        this.purpose = purpose;
        this.lang = lang;

        this.is_ready_promise = $.Deferred();

        // default config
        this.config = {
            header: {},
            show_actions: true,
            show_filter: true,
            show_pagination: true,
            // list of actions available for applying to a selection (relational fields widgets define their own actions)
            selection_actions: [],
            // #todo - move this elsewhere
            selection_actions_default: [
                {
                    id: "ACTION.EDIT_INLINE",
                    label: 'SB_ACTIONS_BUTTON_INLINE_UPDATE',
                    icon:  'edit_attributes',
                    primary: false,
                    handler: (selection: any, item: any) => this.actionSelectionInlineEdit(selection)
                },
                {
                    id: "ACTION.EDIT_BULK",
                    label: 'SB_ACTIONS_BUTTON_BULK_ASSIGN',
                    icon:  'dynamic_form',
                    primary: false,
                    visible: false,
                    handler: (selection: any, item: any) => this.actionSelectionBulkAssign(selection)
                },
                {
                    id: "ACTION.EDIT",
                    label: 'SB_ACTIONS_BUTTON_UPDATE',
                    icon:  'edit',
                    primary: true,
                    handler: (selection: any, item: any) => {
                        let selected_id = selection[0];
                        this.openContext({entity: this.entity, type: 'form', name: this.name, domain: ['id', '=', selected_id], mode: 'edit', purpose: 'update'});
                    }
                },
                {
                    id: "ACTION.CLONE",
                    label: 'SB_ACTIONS_BUTTON_CLONE',
                    icon:  'content_copy',
                    primary: false,
                    handler: async (selection: any, item: any) => {
                        try {
                            // #todo - global loader: prevent any action (loader on context, frame, root)
                            // show loader
                            this.layout.loading(true);
                            await ApiService.clone(this.entity, selection);
                            // hide loader
                            this.layout.loading(false);
                            // refresh the model
                            await this.onchangeView();
                        }
                        catch(response) {
                            console.warn('unexpected error', response);
                            // hide loader
                            this.layout.loading(false);
                            try {
                                await this.displayErrorFeedback(this.translation, response);
                            }
                            catch(error) {
                                console.warn(error);
                            }
                        }
                    }
                },
                {
                    id: "ACTION.ARCHIVE",
                    label: 'SB_ACTIONS_BUTTON_ARCHIVE',
                    icon:  'archive',
                    primary: false,
                    handler: async (selection:any, item:any) => {
                        // display confirmation dialog with checkbox for archive
                        let $dialog = UIHelper.createDialog('confirm_archive_dialog', TranslationService.instant('SB_ACTIONS_ARCHIVE_CONFIRM'), TranslationService.instant('SB_DIALOG_ACCEPT'), TranslationService.instant('SB_DIALOG_CANCEL'));
                        $dialog.addClass('sb-view-dialog').appendTo(this.$container);
                        // inject component as dialog content
                        this.decorateDialogArchiveConfirm($dialog);

                        $dialog.trigger('Dialog:_open')
                        .on('_ok', async (event, result) => {
                            try {
                                await ApiService.archive(this.entity, selection);
                                // refresh the model
                                await this.onchangeView();
                            }
                            catch(response) {
                                try {
                                    await this.displayErrorFeedback(this.translation, response);
                                }
                                catch(error) {

                                }
                            }
                        });
                    }
                },
                {
                    id: "ACTION.DELETE",
                    label: 'SB_ACTIONS_BUTTON_DELETE',
                    icon:  'delete',
                    primary: true,
                    handler: async (selection:any, item:any) => {
                        // display confirmation dialog with checkbox for permanent deletion
                        let $dialog = UIHelper.createDialog(this.uuid+'_confirm-deletion-dialog', TranslationService.instant('SB_ACTIONS_DELETION_CONFIRM'), TranslationService.instant('SB_DIALOG_ACCEPT'), TranslationService.instant('SB_DIALOG_CANCEL'));
                        $dialog.addClass('sb-view-dialog').appendTo(this.$container);
                        // inject component as dialog content
                        this.decorateDialogDeletionConfirm($dialog);

                        $dialog.trigger('Dialog:_open')
                        .on('_ok', async (event, result) => {
                            if(result.confirm) {
                                try {
                                    await ApiService.delete(this.entity, selection, false);
                                    // refresh the model
                                    this.onchangeView();
                                }
                                catch(response) {
                                    try {
                                        await this.displayErrorFeedback(this.translation, response);
                                    }
                                    catch(error) {

                                    }
                                }
                            }
                        });
                    }
                }
            ]
            // #todo - selection by section (grouped lines)
            // selected_sections: {1: 2}
        };

        // override config options, if other are given
        if(config) {
            // #todo - attributes like `selection_actions` or `show_...`  shouldn't be set directly in widgets nor provided config, and should rather be computed here below based on other values
            this.config = $.extend(true, {}, this.config, config);
            if(this.config.header.hasOwnProperty('selection') && !this.config.header.selection) {
                this.config.selection_actions = [];
            }
        }

        this.mode = (this.config.hasOwnProperty('mode')) ? this.config.mode : this.mode;
        this.controller = (this.config.hasOwnProperty('controller')) ? this.config.controller: View.DEFAULT_CONTROLLER;
        this.order = (this.config.hasOwnProperty('order')) ? this.config.order : View.DEFAULT_ORDER;
        this.sort = (this.config.hasOwnProperty('sort')) ? this.config.sort : View.DEFAULT_SORT;
        this.start = (this.config.hasOwnProperty('start')) ? this.config.start : View.DEFAULT_START;
        this.limit = (this.config.hasOwnProperty('limit')) ? this.config.limit : View.DEFAULT_LIMIT;
        this.group_by = (this.config.hasOwnProperty('group_by')) ? this.config.group_by : View.DEFAULT_GROUP_BY;

        this.selected_ids = [];

        this.applied_filters_ids = [];

        this.filters = {};
        this.custom_actions = {};

        this.exports = {
            "export.pdf": {
                "id": "export.pdf",
                "label": TranslationService.instant('SB_EXPORTS_AS_PDF'),
                "icon": "picture_as_pdf",
                "description": "Export as PDF",
                "controller": "model_export-pdf",
                "view": this.getId(),
                "domain": JSON.stringify(this.getDomain())
            },
            "export.xls": {
                "id": "export.xls",
                "label": TranslationService.instant('SB_EXPORTS_AS_XLS'),
                "icon": "description",
                "description": "Export as XLS",
                "controller": "model_export-xls",
                "view": this.getId()
            }
        };

        if(this.type == 'chart') {
            this.exports = {
                "export.xls": {
                    "id": "export.xls",
                    "label": TranslationService.instant('SB_EXPORTS_AS_XLS'),
                    "icon": "print",
                    "description": "Export as XLS",
                    "controller": "model_export-chart-xls",
                    "view": this.getId()
                }
            };

        }

        this.$container = $('<div />').attr('id', this.getUuid()).addClass('sb-view')
            .attr('data-view_id', this.getId())
            .attr('data-entity', this.entity)
            .attr('data-mode', this.mode)
            .attr('data-purpose', this.purpose)
            .hide();

        this.$headerContainer = $('<div />').addClass('sb-view-header').appendTo(this.$container);
        this.$layoutContainer = $('<div />').addClass('sb-view-layout').appendTo(this.$container);
        this.$footerContainer = $('<div />').addClass('sb-view-footer').appendTo(this.$container);

        this.layout = LayoutFactory.getLayout(this);
        this.model = new Model(this);

        this.init();
    }

    private async init() {
        console.debug('View::init', this.entity, this.type, this.name, this);
        try {

            // assign schemas by copy

            const translation = await ApiService.getTranslation(this.entity);
            this.translation = this.deepCopy(translation);

            const model = await ApiService.getSchema(this.entity, this.getDomain());
            this.model_schema = this.deepCopy(model);

            let view = await ApiService.getView(this.entity, this.type + '.' + this.name);
            if(!Object.keys(view).length) {
                // #memo - fallback to default view is performed in the back-end
                console.warn("no result for " + this.entity + "." + this.type + "." + this.name + ", stop processing");
                throw new Error('unable to retrieve specified view: ' + this.entity + "." + this.type + "." + this.name);
            }
            this.view_schema = this.deepCopy(view);

            this.loadViewFields(this.view_schema);
            this.loadModelFields(this.model_schema);

            // #memo - received config takes precedence

            if(this.view_schema.hasOwnProperty("header")) {
                this.config.header = {...this.view_schema.header, ...this.config.header};
            }

            if(this.view_schema.hasOwnProperty("order") && this.order == View.DEFAULT_ORDER) {
                this.order = this.view_schema.order;
            }

            if(this.view_schema.hasOwnProperty("sort") && this.sort == View.DEFAULT_SORT) {
                this.sort = this.view_schema.sort;
            }

            if(this.view_schema.hasOwnProperty("start") && this.start == View.DEFAULT_START) {
                this.start = +this.view_schema.start;
            }

            if(this.view_schema.hasOwnProperty("limit") && this.limit == View.DEFAULT_LIMIT) {
                this.limit = +this.view_schema.limit;
            }

            if(this.view_schema.hasOwnProperty("group_by") && this.group_by == View.DEFAULT_GROUP_BY) {
                this.group_by = this.view_schema.group_by;
            }

            // predefined filters
            if(this.view_schema.hasOwnProperty("filters")) {
                if(Array.isArray(this.view_schema.filters)) {
                    for(let item of this.view_schema.filters) {
                        this.filters[item.id] = item;
                    }
                }
                else {
                    // 'filters' is set and is not an array (expected to be false)
                    this.config.show_filter = false;
                }
            }

            // override of default controller
            if(this.view_schema.hasOwnProperty("controller")) {
                this.controller = this.view_schema.controller;
            }

            if(this.view_schema.hasOwnProperty("mode")) {
                this.mode = this.view_schema.mode;
            }

            if(this.view_schema.hasOwnProperty("exports")) {
                for(let item of this.view_schema.exports) {
                    this.exports[item.id] = item;
                }
            }

            // #memo - actions handling differs from one view type to another (list, form, ...)
            if(this.view_schema.hasOwnProperty('header') && this.view_schema.header.hasOwnProperty('actions')) {
                for(const [id, item] of Object.entries(this.view_schema.header.actions)) {
                    this.custom_actions[id] = item;
                }
            }

            // some custom actions might have been defined in the parent view, if so, override the view schema
            if(this.config.header?.hasOwnProperty('actions')) {
                for(const [id, item] of Object.entries(this.config.header.actions)) {
                    this.custom_actions[id] = item;
                }
            }

            // support for custom selection_actions
            // expects a controller to which the selected_ids will be relayed, upon response the list is refreshed

            // #memo - selection action must be present for widget view
            if(this.purpose == 'view' || this.purpose == 'widget') {
                if(this.config.header.hasOwnProperty('selection')) {
                    if(!this.config.header.selection) {
                        // if selection is disabled, force mode to view (to prevent displaying checkboxes)
                        // #memo - for child views, mode can be switched through parent view
                        this.mode = 'view';
                    }
                    else {
                        if(!this.config.header.selection.hasOwnProperty('default') || this.config.header.selection.default == true) {
                            // use default actions unless default explicitly set to false
                            this.config.selection_actions = this.config.selection_actions_default;
                        }
                        if(this.config.header.selection.hasOwnProperty('actions') && Array.isArray(this.config.header.selection.actions)) {
                            for(let action of this.config.header.selection.actions) {
                                // enrich the item with an action handler based on given controller, if any
                                action['handler'] = async (selection:any, item:any) => {
                                    if(item.hasOwnProperty('controller')) {
                                        try {
                                            let resulting_params:any = {
                                                entity: this.getEntity(),
                                                ids: selection,
                                                // make sure the targeted controller is not meant for single object (expecting an `id` param)
                                                id: 0,
                                                lang: this.getLang()
                                            };
                                            // #todo - export to a dedicated class : from here code is very close to `decorateActionButton` in Layout class
                                            let missing_params: any = {};
                                            let user = this.getUser();

                                            // 1) pre-feed with params from the action, if any

                                            if(!action.hasOwnProperty('params')) {
                                                action['params'] = {};
                                            }

                                            // inject params of current view as (sub) params
                                            action.params['params'] = this.getParams();

                                            let object:any = {};
                                            let parent:any = {};

                                            // if view is a form, add object reference
                                            if(this.getType() == 'form') {
                                                let model = view.getModel();
                                                let objects = await model.get();
                                                object = objects[0];
                                                // by convention, add current object id as reference
                                                if(object.hasOwnProperty('id') && !action.params.hasOwnProperty('id')) {
                                                    action.params['id'] = 'object.id';
                                                }
                                            }

                                            // if view is a widget, add parent object reference
                                            if(this.getContext().getView() != this) {
                                                let parentView: View = this.getContext().getView();
                                                let parent_objects = await parentView.getModel().get();
                                                parent = parent_objects[0];
                                            }

                                            // inject referenced values in the resulting params
                                            for(let param of Object.keys(action.params)) {
                                                let ref = new Reference(action.params[param]);
                                                // #todo - add support for env
                                                resulting_params[param] = ref.parse(object, user, parent);
                                            }

                                            // 2) retrieve announcement from the target action controller

                                            const result = await ApiService.fetch("/", {do: action.controller, announce: true, ...resulting_params});
                                            let params: any = {};
                                            let response_descr: any = {};
                                            let description: string = '';

                                            if(result.hasOwnProperty('announcement')) {
                                                if(result.announcement.hasOwnProperty('params')) {
                                                    params = result.announcement.params;
                                                }
                                                for(let param of Object.keys(params)) {
                                                    if(Object.keys(resulting_params).indexOf(param) < 0) {
                                                        if(params[param].hasOwnProperty('required') && params[param].required) {
                                                            missing_params[param] = params[param];
                                                        }
                                                        else if(action.hasOwnProperty('confirm') && action.confirm) {
                                                            missing_params[param] = params[param];
                                                        }
                                                    }
                                                }
                                                if(result.announcement.hasOwnProperty('response')) {
                                                    response_descr = result.announcement.response;
                                                }
                                                if(result.announcement.hasOwnProperty('description')) {
                                                    description = result.announcement.description;
                                                }
                                            }

                                            // retrieve translation related to action, if any
                                            let translation = await ApiService.getTranslation(action.controller.replaceAll('_', '\\'));

                                            // check presence of description and fallback to controller description
                                            if(action.hasOwnProperty('description')) {
                                                description = action.description;
                                            }

                                            let translated_description = TranslationService.resolve(translation, '', [], '', description, 'description');
                                            // no translation was found for controller
                                            if(translated_description == description) {
                                                // fallback to current view translation
                                                description = TranslationService.resolve(this.getTranslation(), 'view', [this.getId(), 'actions'], action.id, description, 'description');
                                            }
                                            else {
                                                description = translated_description;
                                            }

                                            let defer = $.Deferred();
                                            let $description = $('<p />').text(description);

                                            if(action.hasOwnProperty('confirm') && action.confirm) {
                                                // params dialog
                                                if(Object.keys(missing_params).length) {
                                                    let $dialog = UIHelper.createDialog(this.getUuid()+'_'+action.id+'_custom_action_dialog', TranslationService.instant('SB_ACTIONS_PROVIDE_PARAMS'), TranslationService.instant('SB_DIALOG_SEND'), TranslationService.instant('SB_DIALOG_CANCEL'));
                                                    $dialog.find('.mdc-dialog__content').append($description);
                                                    await this.decorateActionDialog($dialog, action, missing_params, object, user, parent);
                                                    $dialog.addClass('sb-view-dialog').appendTo(this.getContainer());
                                                    $dialog
                                                        .on('_accept', () => defer.resolve($dialog.data('result')))
                                                        .on('_reject', () => defer.reject() );
                                                    $dialog.trigger('Dialog:_open');
                                                }
                                                // confirm dialog
                                                else {
                                                    // display confirmation dialog with checkbox for archive
                                                    let $dialog = UIHelper.createDialog(this.getUuid()+'_'+action.id+'_confirm-action-dialog', TranslationService.instant('SB_ACTIONS_CONFIRM'), TranslationService.instant('SB_DIALOG_ACCEPT'), TranslationService.instant('SB_DIALOG_CANCEL'));
                                                    $dialog.find('.mdc-dialog__content').append($description);
                                                    $dialog.appendTo(this.getContainer());
                                                    $dialog
                                                        .on('_accept', () => defer.resolve())
                                                        .on('_reject', () => defer.reject() );
                                                    $dialog.trigger('Dialog:_open');
                                                }
                                            }
                                            else {
                                                // params dialog
                                                if(Object.keys(missing_params).length) {
                                                    let $dialog = UIHelper.createDialog(this.getUuid()+'_'+action.id+'_custom_action_dialog', TranslationService.instant('SB_ACTIONS_PROVIDE_PARAMS'), TranslationService.instant('SB_DIALOG_SEND'), TranslationService.instant('SB_DIALOG_CANCEL'));
                                                    $dialog.find('.mdc-dialog__content').append($description);
                                                    await this.decorateActionDialog($dialog, action, missing_params, object, user, parent);
                                                    $dialog.addClass('sb-view-dialog').appendTo(this.getContainer());
                                                    $dialog
                                                        .on('_accept', () => defer.resolve($dialog.data('result')))
                                                        .on('_reject', () => defer.reject() );
                                                    $dialog.trigger('Dialog:_open');
                                                }
                                                // perform action without dialog
                                                else {
                                                    defer.resolve();
                                                }
                                            }

                                            defer.promise().then( async (result:any) => {
                                                // mark action button as loading
                                                try {
                                                    await this.performAction(action, {...resulting_params, ...result}, response_descr);
                                                }
                                                catch(response) {

                                                }
                                            })
                                            .catch( () => {
                                                // error running action
                                            });
                                        }
                                        catch(response) {
                                            console.warn('unexpected error', response);
                                            try {
                                                await this.displayErrorFeedback(this.translation, response);
                                            }
                                            catch(error) {
                                                console.warn(error);
                                            }
                                        }
                                    }
                                };
                                if(action.hasOwnProperty('id')) {
                                    // check amongst actions already added (defaults ?)
                                    let index = this.config.selection_actions.findIndex( (item:any) => (item && item.hasOwnProperty('id') && item.id == action.id) );
                                    if(index >= 0) {
                                        if(action.hasOwnProperty('visible') && action.visible === false) {
                                            this.config.selection_actions.splice(index, 1);
                                        }
                                        else if(action.hasOwnProperty('controller')) {
                                            // overload a default action
                                            this.config.selection_actions[index] = action;
                                        }
                                    }
                                    else {
                                        let index = this.config.selection_actions_default.findIndex( (item:any) => item.id == action.id );
                                        if(index >= 0) {
                                            // id matches a default action: use action from defaults
                                            this.config.selection_actions.push(this.config.selection_actions_default[index]);
                                        }
                                        else {
                                            // unknown id: add action as-is
                                            this.config.selection_actions.push(action);
                                        }
                                    }
                                }
                                else {
                                    // no id: add action as-is
                                    this.config.selection_actions.push(action);
                                }
                            }
                        }

                    }
                }
                // no header.selection property: assign default actions
                else {
                    // #todo - selection_actions might have been set in the config (it is the case for many2many widget - this should be replaced by the use of header.selection)
                    if(!Array.isArray(this.config.selection_actions) || this.config.selection_actions.length == 0) {
                        this.config.selection_actions = this.config.selection_actions_default;
                    }
                }
            }

            // domain member is given by the context
            // if view is a non-widget list then context domain is visible and can be changed by user
            // (otherwise, context domain is merged to view domain and cannot be changed by user)
            // #memo - this has been removed because it decreases ability to reuse views across distinct contexts (we don't want the user to change the domain since it is part of the context consistency)
            /*
            if(this.type == 'list' && this.purpose == 'view' && this.domain && Array.isArray(this.domain)) {
                let i = 0;
                let tmpDomain = new Domain(this.domain);
                for(let clause of tmpDomain.getClauses()) {
                    ++i;
                    let description = await this.translateFilterClause(clause);
                    let filter = {
                        "id": "filter_domain_"+i,
                        "label": "search",
                        "description": description,
                        "clause": clause.toArray()
                    };
                    // add filter to applied filters
                    this.filters[filter.id] = filter;
                    this.applied_filters_ids.push(filter.id);
                }

                this.domain = [];
            }
            */

            // view schema specifies a domain: merge it with the received context domain
            // domain from the view is fixed, not visible, and cannot be changed by user
            if(this.view_schema.hasOwnProperty("domain")) {
                // convert domain attribute (either a string or an array)
                let domain = [];
                if(Array.isArray(this.view_schema.domain)) {
                    domain = this.view_schema.domain;
                }
                else {
                    try {
                        domain = JSON.parse(this.view_schema.domain);
                    }
                    catch(error) {
                        console.error('View::init - Invalid JSON in view_schema.domain', error);
                    }
                }

                let viewDomain = new Domain(domain);

                // assign domain to the view
                /*
                if(this.purpose == 'view') {
                    this.domain = viewDomain.toArray();
                }
                else {
                */
                    // merge domains
                    let tmpDomain = new Domain(this.domain);
                    this.domain = tmpDomain.merge(viewDomain).toArray();
                //}

            }

            const header_layout = ( (this.config.header?.layout ?? 'full') === 'inline') ? 'inline' : 'full';
            this.$container.addClass('header-' + header_layout);

            if(['list', 'cards'].indexOf(this.type) >= 0) {
                this.$layoutContainer.addClass('sb-view-layout-list');
                this.layoutListHeader();
                this.layoutListFooter();
            }
            if(['form'].indexOf(this.type) >= 0) {
                this.$layoutContainer.addClass('sb-view-layout-form');
                this.layoutFormHeader();
            }
            if(['chart'].indexOf(this.type) >= 0) {
                if(this.mode == 'grid') {
                    this.layoutChartHeader();
                    this.$layoutContainer.addClass('sb-view-layout-list');
                }
                else {
                    this.$layoutContainer.addClass('sb-view-layout-chart');
                }
            }

            await this.layout.init();
            await this.model.init();
        }
        catch(err) {
            console.warn('Unable to init view (' + this.entity + '.' + this.getId() + ')', err);
        }

        this.$container.show();

        this.is_ready_promise.resolve();
        console.debug("View::init - resulting config", this.config);
    }

    private deepCopy(obj:any): any {
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

    private hasAdvancedFilters(): boolean {
        if(this.config.header.hasOwnProperty('advanced_search') && !this.config.header.advanced_search) {
            return false;
        }
        return (['core_model_collect', 'model_collect'].indexOf(this.controller) < 0);
    }

    public destroy() {
        if(this.layout && typeof this.layout.destroy === 'function') {
            this.layout.destroy();
        }
    }

    public addSubscriber(events: string[], callback: (context: any) => void) {
        for(let event of events) {
            // if(!['open', 'close', 'updated', 'navigate'].includes(event)) continue;
            if(!this.subscribers.hasOwnProperty(event)) {
                this.subscribers[event] = [];
            }
            this.subscribers[event].push(callback);
        }
    }

    public setActiveObjectId(id: number) {
        console.debug('View::setActiveObjectId - setting active object id', id);
        this.activeObjectId = id;
    }

    public getActiveObjectId() {
        console.debug('View::getActiveObjectId - current active object id', this.activeObjectId);
        return this.activeObjectId;
    }

    public async navigationAction(action: string) {
        console.debug('View::navigationAction - performing navigation action', action, this.activeObjectId);
        let objects = await this.model.get();

        if(objects.length <= 1) {
            return;
        }

        let index: number = objects.findIndex((obj: any) => obj.id === this.activeObjectId);

        if(index === -1) {
            index = 0;
        }

        switch(action) {
            case 'prev':
                --index;
                if(index < 0) {
                    await this.paginationAction('prev');
                    objects = await this.model.get();
                    index = Math.max(0, objects.length - 1);
                }
                break;
            case 'next':
                ++index;
                if(index >= objects.length) {
                    await this.paginationAction('next');
                    objects = await this.model.get();
                    index = 0;
                }
                break;
        }
        if(objects.length === 0) {
            return;
        }
        this.setActiveObjectId(objects[index].id);
    }

    public async paginationAction(action: string) {
        console.debug('View::paginationAction - performing pagination action ', action);
        const limit = this.getLimit();
        const start = this.getStart();
        const total = this.getTotal();

        // last possible valid offset (0 if total = 0)
        const last_valid_start = (total > 0)
            ? Math.floor((total - 1) / limit) * limit
            : 0;

        switch(action) {
            case 'first':
                this.setStart(0);
                // update Model and set active index to last entry of loaded page
                await this.onchangeView(false, limit - 1);
                break;
            case 'prev':
                this.setStart(
                    Math.max(
                        0,
                        start - limit
                    )
                );
                // update Model and set active index to last entry of loaded page
                await this.onchangeView(false, limit - 1);
                break;
            case 'next':
                this.setStart(
                    Math.min(
                        last_valid_start,
                        start + limit
                    )
                );
                // update Model and set active index to first entry of loaded page
                await this.onchangeView(false, 0);
                break;
            case 'last':
                this.setStart(last_valid_start);
                // update Model and set active index to first entry of loaded page
                await this.onchangeView(false, 0);
                break;
        }
    }

    /**
     * This is meant to be used by children components, in order to control the View according to specific bahavior
     *
     * Supported actions:
     *
     * ACTION.EDIT
     * ACTION.SAVE
     * ACTION.CANCEL
     *
     */
    public triggerAction(action: string) {
        console.debug('View::triggerAction - received action: ' + action, this);
        if(action == 'ACTION.SELECT') {
            let target = this.$headerContainer.find('#' + this.uuid + '_action-add').first();

            if(!target.length) {
                target = this.$headerContainer.find('#' + this.uuid + '_action-select').first();
            }

            if(target.length) {
                target.trigger('click');
            }
        }
        else if(action == 'ACTION.EDIT') {
            if(this.mode == 'view') {
                this.$headerContainer.find('#' + this.uuid + '_action-edit').first().trigger('click');
            }
        }
        else if(action == 'ACTION.SAVE') {
            if(this.mode == 'edit') {
                // retrieve the first button amongst the view actions and trigger a click
                let $saveButton = this.$headerContainer.find('#' + this.uuid + '_action-save').first();
                // blur any active input (in order to trigger `_updatedWidget`)
                $saveButton.trigger('focus');
                // wait for the model to be updated and run the action
                setTimeout( () => {
                    $saveButton.trigger('click');
                }, 250);
            }
        }
        else if(action == 'ACTION.CANCEL') {
            // retrieve the first button amongst the view actions and trigger a click
            this.$headerContainer.find('#' + this.uuid + '_action-cancel').first().trigger('click');
        }
    }

    public keyboardAction(action: string) {
        if(action == 'ctrl_s') {
            this.triggerAction('ACTION.SAVE');
        }
        else if(action == 'esc') {
            this.triggerAction('ACTION.CANCEL');
        }
    }

    public isReady() {
        return this.is_ready_promise;
    }

    public getEnv() {
        return this.context.getEnv();
    }

    public getContext() : Context {
        return this.context;
    }

    public getUser() {
        return this.context.getUser();
    }

    /**
     *
     * @returns Returns the identifier of the view (i.e. {type.name})
     */
    public getId() {
        return this.type + '.' + this.name;
    }

    public getUuid() {
        return this.uuid;
    }

    public getCustomActions() {
        return this.custom_actions;
    }

    /**
     * Relay Context opening requests to parent Context.
     *
     * @param config
     */
    public async openContext(config: any) {
        console.debug('View::openContext', config);
        await this.context.openContext(config);
    }

    public async closeContext(data: any = {}, silent: boolean = false) {
        await this.context.closeContext(data, silent);
    }

    /**
     * Relay update notification (from View) to parent Frame.
     */
    public async updatedContext(updated: any = {}) {
        console.debug('View::updatedContext');
        await this.context.updatedContext(updated);
    }

    public getConfig() {
        return this.config;
    }

    public setMode(mode: string) {
        this.mode = mode;
    }

    /**
     * Arbitrary mark parent context as changed (for requesting it to refresh parent contexts when view closes)
     */
    public setChanged() {
        this.context.setChanged();
    }

    // either the model or the view itself can be marked as change (to control the parent context refresh)
    public hasChanged() {
        return this.model.hasChanged();
    }

    public getContainer() {
        return this.$container;
    }

    public setField(field: string, value: any) {
        this.view_fields[field] = value;
    }

    public getField(field: string) {
        return this.view_fields[field];
    }

    public setSort(sort: string) {
        this.sort = sort;
    }

    public setOrder(order: string) {
        this.order = order;
    }

    public setStart(start: number) {
        this.start = start;
    }

    public setLimit(limit: number) {
        this.limit = limit;
    }

    public getEntity() {
        return this.entity;
    }

    public getType() {
        return this.type;
    }

    public getName() {
        return this.name;
    }

    public getTranslation() {
        return this.translation;
    }

    public getViewSchema() {
        return this.view_schema;
    }

    public getModelSchema() {
        return this.model_schema;
    }

    public setDomain(domain: any[]) {
        this.domain = domain;
    }

    public setContextDomain(domain: any[]) {
        console.debug('View::setContextDomain - setting context domain', domain);
        this.context.setDomain(domain);
    }

    /**
     * Applicable domain for the View corresponds to initial domain (from parent Context) with additional filters currently applied on the View
     */
    public getDomain(): any[] {
        console.debug('View::getDomain', this.domain, this.applied_filters_ids);

        let filters_domain = new Domain([]);

        for(let filter_id of this.applied_filters_ids) {
            if(this.filters[filter_id].hasOwnProperty('clause')) {
                // filters clauses are cumulative (conjunctions conditions)
                filters_domain.merge(new Domain(this.filters[filter_id].clause));
            }
            else if(this.filters[filter_id].hasOwnProperty('domain')) {
                filters_domain.merge(new Domain(this.filters[filter_id].domain));
            }
        }

        let resulting_array: any[] = (new Domain(this.domain)).merge(filters_domain).parse({}, this.getUser()).toArray();
        console.debug('View::getDomain - resulting array', resulting_array);
        return resulting_array;
    }

    public getParams() {
        return {
            lang:   this.getLang(),
            order:  this.getOrder(),
            sort:   this.getSort(),
            start:  this.getStart(),
            limit:  this.getLimit(),
            ...this.params
        };
    }

    public getController() {
        return this.controller;
    }

    public getSort() {
        return this.sort;
    }

    public getOrder() {
        return this.order;
    }

    public getStart() {
        return +this.start;
    }

    public getLimit() {
        return +this.limit;
    }

    public getGroupBy() {
        return this.group_by;
    }

    public getLang() {
        return this.lang;
    }

    public getLocale() {
        return this.config.locale;
    }

    public getTotal() {
        return this.getModel().getTotal();
    }

    public getModel() {
        return this.model;
    }

    public getLayout() {
        return this.layout;
    }

    public getMode() {
        return this.mode;
    }

    public getPurpose() {
        return this.purpose;
    }

    /**
     * Returns an associative array mapping fields names with their layout definition
     */
    public getViewFields() {
        return this.view_fields;
    }

    /**
     * Returns an associative array mapping fields names with their model definition
     */
    public getModelFields() {
        return this.model_fields;
    }

    /**
     * Dynamically update a model definition.
     * This is mostly used to update the model after an onchange event (ex. change in the selection)
     */
    public updateModelField(field: string, attribute: string, def: any) {
        this.model_fields[field][attribute] = def;
    }

    /**
     * Generates a map holding all fields (as items objects) that are present in a given view
     * and stores them in the ::`view_fields` map (does not maintain the field order)
     */
	private loadViewFields(view_schema: any) {
        console.debug('View::loadFields', view_schema);
        this.view_fields = {};
        var stack = [];

        let processNode = (node: any) => {
            if(node.visible ?? false) {
                this.extractFieldsFromDomain(node.visible).forEach( (f: string) => {this.view_fields[f] = {type: 'field', value: f};});
            }
            if(node.domain ?? false) {
                this.extractFieldsFromDomain(node.domain).forEach( (f: string) => {this.view_fields[f] = {type: 'field', value: f};});
            }
        };

        if(view_schema.hasOwnProperty('routes')) {
            for(const route of this.view_schema.routes) {
                if(route.context?.domain) {
                    this.extractFieldsFromDomain(route.context.domain).forEach( (f: string) => {this.view_fields[f] = {type: 'field', value: f};});
                }
                if(route.visible) {
                    this.extractFieldsFromDomain(route.visible).forEach( (f: string) => {this.view_fields[f] = {type: 'field', value: f};});
                }
            }
        }

        if(view_schema.hasOwnProperty('actions')) {
            for(const action of this.view_schema.actions) {
                if(action.visible) {
                    this.extractFieldsFromDomain(action.visible).forEach( (f: string) => {this.view_fields[f] = {type: 'field', value: f};});
                }
            }
        }

        if(view_schema.hasOwnProperty('layout')) {
            stack.push(view_schema['layout']);
            const path = ['groups', 'sections', 'rows', 'columns'];

            while(stack.length) {
                var elem: any = stack.pop();

                processNode(elem);

                if(elem.hasOwnProperty('items')) {
                    for(let item of elem['items']) {
                        processNode(elem);
                        if(item.type == 'field' && item.hasOwnProperty('value')) {
                            this.view_fields[item.value] = item;
                        }
                    }
                }
                else {
                    // recurse through layout structure
                    for(let step of path) {
                        if(elem.hasOwnProperty(step)) {
                            for(let obj of elem[step]) {
                                stack.push(obj);
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Stores a map holding all fields from given model schema in the `model_fields` member.
     */
	private loadModelFields(model_schema: any) {
        console.debug('View::loadModelFields', model_schema);
        this.model_fields = model_schema.fields;

        let processField = (node: any) => {
            if(node.visible ?? false) {
                this.extractFieldsFromDomain(node.visible).forEach( (f: string) => {
                    if(!this.view_fields.hasOwnProperty(f)) {
                        this.view_fields[f] = {type: 'field', value: f};
                    }
                });
            }
            if(node.domain ?? false) {
                this.extractFieldsFromDomain(node.domain).forEach( (f: string) => {
                    if(!this.view_fields.hasOwnProperty(f)) {
                        this.view_fields[f] = {type: 'field', value: f};
                    }
                });
            }
        };
        // #todo  - make sure fields referenced in domains are present in view_fields
    }

    private layoutListFooter() {
        // it is best UX practice to avoid footer on lists
    }

    private layoutListHeader() {
        console.debug('View::layoutListHeader');

        // append header structure
        this.$headerContainer.append(' \
            <div class="sb-view-header-list"> \
                <div class="sb-view-header-actions"></div> \
                <div class="sb-view-header-advanced"></div> \
                <div class="sb-view-header-list-navigation"></div> \
            </div>'
        );

        const header_layout = ( (this.config.header?.layout ?? 'full') === 'inline') ? 'inline' : 'full';
        const header_actions_disabled = ( typeof this.config.header?.actions === 'boolean' && !this.config.header.actions );

        let $elem = this.$headerContainer.find('.sb-view-header-list');

        let $actions_set = $elem.find('.sb-view-header-actions');

        let $level1 = $elem.find('.sb-view-header-advanced');
        let $level2 = $elem.find('.sb-view-header-list-navigation');

        // left side : standard actions for views
        let $std_actions = $('<div />').addClass('sb-view-header-actions-std').appendTo($actions_set);
        // inline header : merged header-actions & header-list
        let $std_actions_inline = $('<div />');

        // right side : the actions specific to the view, and depending on object status
        let $view_actions = $('<div />').addClass('sb-view-header-actions-view').appendTo($actions_set);

        // assign select & create default behavior
        let has_action_select = (this.mode === 'view' && (this.purpose === 'select' || this.purpose === 'add'));
        let has_action_create = (this.type === 'list' && (this.purpose !== 'widget' || this.mode === 'edit'));
        let has_action_create_inline = (header_layout === 'inline' && !header_actions_disabled);

        if(this.custom_actions.hasOwnProperty('ACTION.SELECT')) {
            has_action_select = this.isActionEnabled(this.custom_actions['ACTION.SELECT'], this.mode);
        }
        if(this.custom_actions.hasOwnProperty('ACTION.CREATE') && !header_actions_disabled) {
            has_action_create = this.isActionEnabled(this.custom_actions['ACTION.CREATE'], this.mode);
            if(!has_action_create) {
                // explicit disabling of create implies no create_inline as well
                has_action_create_inline = false;
            }
        }

        if(this.custom_actions.hasOwnProperty('ACTION.CREATE_INLINE') || (header_layout === 'inline' && has_action_create && !header_actions_disabled)) {
            // create & create_inline are mutually exclusive
            has_action_create = false;
            has_action_create_inline = this.isActionEnabled(this.custom_actions['ACTION.CREATE_INLINE'], this.mode);
        }

        console.debug('View::layoutListHeader:resulting = has_action_ ', has_action_select, has_action_create, has_action_create_inline, header_layout, this.custom_actions, this.entity, this.getId());

        // append view actions, if requested
        if(this.config.show_actions && !header_actions_disabled) {
            switch(this.purpose) {
                // #memo - buttons can be displayed for widgets (handled at the widget level, since a callback must be set to fetch the resulting value)
                case 'widget':
                case 'view':
                    if(has_action_create) {
                        let $createActionButton: JQuery;

                        if(header_layout === 'full') {
                            $createActionButton = UIHelper.createButton(this.uuid + '_action-create', TranslationService.instant('SB_ACTIONS_BUTTON_CREATE'), 'raised');
                            $std_actions.prepend($createActionButton);
                        }
                        else {
                            $createActionButton = UIHelper.createButton(this.uuid + '_action-create', TranslationService.instant('SB_ACTIONS_BUTTON_CREATE'), 'mini-fab', 'add');
                            $std_actions_inline.append($createActionButton);
                        }

                        $createActionButton.on('click', async () => {
                            console.debug('layoutListHeader::full $createActionButton.on(click)');
                            try {
                                let view_type = 'form';
                                let view_name = this.name;
                                let domain = this.getDomain();
                                if(this.custom_actions.hasOwnProperty('ACTION.CREATE')) {
                                    if(Array.isArray(this.custom_actions['ACTION.CREATE']) && this.custom_actions['ACTION.CREATE'].length) {
                                        let custom_action_create = this.custom_actions['ACTION.CREATE'][0];
                                        if(custom_action_create.hasOwnProperty('view')) {
                                            let parts = custom_action_create.view.split('.');
                                            if(parts.length) {
                                                view_type = <string> parts.shift();
                                            }
                                            if(parts.length) {
                                                view_name = <string> parts.shift();
                                            }
                                        }
                                        if(custom_action_create.hasOwnProperty('domain')) {
                                            let tmpDomain = new Domain(domain);
                                            tmpDomain.merge(new Domain(custom_action_create['domain']));
                                            domain = tmpDomain.toArray();
                                        }
                                    }
                                }
                                // request a new Context for editing a new object
                                await this.openContext({entity: this.entity, type: view_type, name: view_name, domain: domain, mode: 'edit', purpose: 'create'});
                            }
                            catch(response) {
                                try {
                                    await this.displayErrorFeedback(this.translation, response);
                                }
                                catch(error) {

                                }
                            }
                        });
                    }
                    else if(has_action_create_inline) {
                        let $createActionButton: JQuery;

                        if(header_layout === 'full') {
                            $createActionButton = UIHelper.createButton(this.uuid + '_action-create', TranslationService.instant('SB_ACTIONS_BUTTON_CREATE'), 'raised');
                            $std_actions.prepend($createActionButton);
                        }
                        else {
                            $createActionButton = UIHelper.createButton(this.uuid + '_action-create', TranslationService.instant('SB_ACTIONS_BUTTON_CREATE'), 'mini-fab', 'add');
                            $std_actions_inline.append($createActionButton);
                        }

                        $createActionButton.on('click', async () => {
                            console.debug('layoutListHeader::inline $createActionButton.on(click)');
                            try {
                                /*
                                    créer un objet et le charger
                                    ajouter une ligne en tête de liste
                                    passer la ligne en mode edit
                                */
                                await this.actionCreateInline();
                            }
                            catch(response) {
                                await this.displayErrorFeedback(this.translation, response);
                            }
                        });
                    }
                    break;
                case 'select':
                    if(has_action_create) {
                        let $createActionButton: JQuery;

                        if(header_layout === 'full') {
                            $createActionButton = UIHelper.createButton(this.uuid+'_action-create', TranslationService.instant('SB_ACTIONS_BUTTON_CREATE'), 'text');
                            $std_actions.prepend($createActionButton);
                        }
                        else {
                            $createActionButton = UIHelper.createButton(this.uuid+'_action-create', TranslationService.instant('SB_ACTIONS_BUTTON_CREATE'), 'mini-fab', 'add');
                            $std_actions_inline.append($createActionButton);
                        }

                        $createActionButton.on('click', async () => {
                            try {
                                // request a new Context for editing a new object
                                await this.openContext({entity: this.entity, type: 'form', name: this.name, domain: this.getDomain(), mode: 'edit', purpose: 'create'});
                            }
                            catch(response) {
                                try {
                                    await this.displayErrorFeedback(this.translation, response);
                                }
                                catch(error) {

                                }
                            }
                        });

                    }
                    if(has_action_select) {
                        let $selectActionButton: JQuery;

                        if(header_layout === 'full') {
                            $selectActionButton = UIHelper.createButton(this.uuid+'_action-select', TranslationService.instant('SB_ACTIONS_BUTTON_SELECT'), 'raised', 'check');
                            $std_actions.prepend($selectActionButton);
                        }
                        else {
                            $selectActionButton = UIHelper.createButton(this.uuid+'_action-select', TranslationService.instant('SB_ACTIONS_BUTTON_SELECT'), 'mini-fab', 'add');
                            $std_actions_inline.prepend($selectActionButton);
                        }

                        $selectActionButton.on('click', async () => {
                                // close context and relay selection, if any (mark the view as changed to force parent context update)
                                // #todo : user should not be able to select more thant one id
                                let objects = await this.model.get(this.selected_ids);
                                this.closeContext({selection: this.selected_ids, objects: objects});
                            });
                    }
                    break;
                case 'add':
                    if(has_action_create) {
                        let $createActionButton: JQuery;
                        if(header_layout === 'full') {
                            $createActionButton = UIHelper.createButton(this.uuid+'_action-create', TranslationService.instant('SB_ACTIONS_BUTTON_CREATE'), 'text');
                            $std_actions.prepend($createActionButton);
                        }
                        else {
                            $createActionButton = UIHelper.createButton(this.uuid+'_action-create', TranslationService.instant('SB_ACTIONS_BUTTON_CREATE'), 'mini-fab', 'add');
                            $std_actions_inline.prepend($createActionButton);
                        }

                        $createActionButton.on('click', async () => {
                                try {
                                    // request a new Context for editing a new object
                                    await this.openContext({entity: this.entity, type: 'form', name: this.name, domain: this.getDomain(), mode: 'edit', purpose: 'create'});
                                }
                                catch(response) {
                                    try {
                                        await this.displayErrorFeedback(this.translation, response);
                                    }
                                    catch(error) {

                                    }
                                }
                            });

                    }
                    if(has_action_select) {
                        let $selectActionButton: JQuery;
                        if(header_layout === 'full') {
                            $selectActionButton = UIHelper.createButton(this.uuid+'_action-add', TranslationService.instant('SB_ACTIONS_BUTTON_ADD'), 'raised', 'check');
                            $std_actions.prepend($selectActionButton);
                        }
                        else {
                            $selectActionButton = UIHelper.createButton(this.uuid+'_action-add', TranslationService.instant('SB_ACTIONS_BUTTON_ADD'), 'mini-fab', 'add');
                            $std_actions_inline.prepend($selectActionButton);
                        }

                        $selectActionButton.on('click', async () => {
                                // close context and relay selection, if any (mark the view as changed to force parent context update)
                                let objects = await this.model.get(this.selected_ids);
                                this.closeContext({selection: this.selected_ids, objects: objects});
                            })
                    }
                    break;
                case 'create':
                    break;
                case 'update':
                    break;
                default:
                    break;
            }
        }

        // append advanced layout if requested
        if(this.hasAdvancedFilters()) {
            $elem.addClass('has-advanced-filters');
            let $layout = $('<div class="sb-view-header-advanced-layout" />').appendTo($level1);

            let view = new View(this.getContext(), this.controller.replace(/_/g, '\\'), 'search', 'default', this.getDomain(), 'edit', 'widget', this.lang, {});
            view.isReady().then( () => {
                let updateParams = async () => {
                    // retrieve model of the view
                    let model = view.getModel();
                    let objects = await model.get();
                    let object: any = objects[0];
                    // inject object as part of parent View's body for the Model service
                    for(let field in object) {
                        let value = object[field];
                        if(typeof value == 'object' && value !== null) {
                            value = value.id;
                        }
                        this.params[field] = value;
                    }
                };
                let $container = view.getContainer();
                $layout.append($container);
                // detect view submission / change
                view.addSubscriber(['change'], async () => {
                    await updateParams();
                    // trigger a refresh of the current view
                    this.onchangeView();
                });
                // initial assignment of params from advanced search view
                updateParams();
            });

        }

        //  bulk assign action
        let $bulk_assign_dialog = UIHelper.createDialog('bulk-assign-dialog_' + this.getUuid(), TranslationService.instant('SB_ACTIONS_BUTTON_BULK_ASSIGN'), TranslationService.instant('SB_DIALOG_ACCEPT'), TranslationService.instant('SB_DIALOG_CANCEL'));
        $bulk_assign_dialog.addClass('sb-view-dialog').appendTo(this.$container);
        // inject component as dialog content
        this.decorateBulkAssignDialog($bulk_assign_dialog);


        // container for holding chips of currently applied filters
        let $filters_set = $('<div />').addClass('sb-view-header-list-filters-set mdc-chip-set').attr('role', 'grid');

        // for creating a quick filter based on name
        let $filters_search = $('<div />').addClass('sb-view-header-list-filters-search');
        let $search_input = UIHelper.createInput('sb-view-header-search_' + this.getUuid(), TranslationService.instant('SB_FILTERS_SEARCH'), '', '', '', false, 'outlined', 'close').appendTo($filters_search);

        $search_input.addClass('dialog-select').find('.mdc-text-field__icon').on('click', async (e) => {
            // reset input value
            $search_input.find('input').val('').trigger('focus').trigger('blur');
            // unapply related filter
            await this.unapplyFilter('filter_search_on_name');
        });

        $search_input.on('keypress', (e) => {
            if(e.key == 'Enter') $search_input.find('input').trigger('blur');
        });

        $search_input.find('input').on('blur', (e) => {
            setTimeout( () => {
                let value = String($search_input.find('input').val()).trim();

                if(value.length) {
                    let filter = {
                        "id": "filter_search_on_name",
                        "label": "search",
                        "description": TranslationService.instant('SB_FILTERS_SEARCH_ON_NAME'),
                        "clause": ['name', '=', value]
                    };
                    if(this.model_schema.fields['name'].result_type === 'string') {
                        filter['clause'] = ['name', 'ilike', '%' + value + '%'];
                    }
                    // add filter to available filters
                    this.filters[filter.id] = filter;
                    this.applyFilter(filter.id);
                }
            }, 100);
        });

        if(this.hasAdvancedFilters()) {
            let $advanced_filters_button = $('<div/>').addClass('sb-view-header-list-advanced-filters-button')
                .append( UIHelper.createButton(this.getUuid()+'-advanced-filters', 'filters', 'icon', 'chevron_right') ).prependTo($level1);

            $advanced_filters_button.on('click', () => {
                $elem.toggleClass('is-advanced-open');
                let head_height = this.$headerContainer.height();
                this.$layoutContainer.css({height: 'calc(100% - '+head_height+'px)'});
            });

            this.is_ready_promise.then( () => {
                if(this.config.header.hasOwnProperty('advanced_search') && this.config.header.advanced_search) {
                    if(this.config.header.advanced_search.hasOwnProperty('open') && this.config.header.advanced_search.open) {
                        $advanced_filters_button.trigger('click');
                    }
                }
            });
        }

        // fields toggle menu : button for displaying the filters menu
        let $filters_button = $('<div />').addClass('sb-view-header-list-filters mdc-menu-surface--anchor')
            .append( UIHelper.createButton('view-filters', 'filters', 'icon', 'filter_list') );

        // create floating menu for filters selection
        let $filters_menu = UIHelper.createMenu('filters-menu').addClass('sb-view-header-list-filters-menu').appendTo($filters_button);
        let $filters_list = UIHelper.createList('filters-list').appendTo($filters_menu);

        // generate filters list
        for(let filter_id in this.filters) {
            let filter = this.filters[filter_id];

            UIHelper.createListItem(filter_id, filter.description)
                .appendTo($filters_list)
                .on('click', (event) => {
                    this.applyFilter(filter_id);
                });
        }

        // append additional option for custom filter
        if(Object.keys(this.filters).length) {
            UIHelper.createListDivider().appendTo($filters_list);
        }

        let $custom_filter_dialog = UIHelper.createDialog(this.uuid+'_custom-filter-dialog', TranslationService.instant('SB_FILTERS_ADD_CUSTOM_FILTER'), TranslationService.instant('SB_DIALOG_ACCEPT'), TranslationService.instant('SB_DIALOG_CANCEL'));
        $custom_filter_dialog.addClass('sb-view-dialog').appendTo(this.$container);
        // inject component as dialog content
        this.decorateCustomFilterDialog($custom_filter_dialog);

        UIHelper.createListItem('SB_FILTERS_ADD_CUSTOM_FILTER', TranslationService.instant('SB_FILTERS_ADD_CUSTOM_FILTER'))
            .appendTo($filters_list)
            .on('click', (event) => $custom_filter_dialog.trigger('Dialog:_open') );


        UIHelper.decorateMenu($filters_menu);
        $filters_button.find('button').on('click', () => $filters_menu.trigger('_toggle') );


        // fields toggle menu : button for displaying the fields menu
        let $fieldsToggleButton = $('<div/>').addClass('sb-view-header-list-fields_toggle mdc-menu-surface--anchor')
            .append( UIHelper.createButton('view-fields', 'fields', 'icon', 'more_vert') );

        // create floating menu for fields selection
        let $fieldsToggleMenu = UIHelper.createMenu('fields-menu').addClass('sb-view-header-list-fields_toggle-menu').appendTo($fieldsToggleButton);
        let $fieldsToggleList = UIHelper.createList('fields-list').appendTo($fieldsToggleMenu);

        if(header_layout != 'full') {
            $fieldsToggleButton.hide();
        }

        // #todo : translate fields names
        for(let item of this.getViewSchema().layout.items ) {
            let label = (item.hasOwnProperty('label')) ? item.label : (item.value.charAt(0).toUpperCase() + item.value.slice(1));
            let visible = (item.hasOwnProperty('visible')) ? item.visible : true;

            UIHelper.createListItemCheckbox('sb-fields-toggle-checkbox_' + this.getUuid() + '_' + item.value, label)
                .appendTo($fieldsToggleList)
                .find('input')
                .on('change', (event) => {
                    let $this = $(event.currentTarget);
                    let def = this.getField(item.value);
                    def.visible = $this.prop('checked');
                    this.setField(item.value, def);
                    this.onchangeModel(true);
                })
                .prop('checked', visible);
        }

        UIHelper.decorateMenu($fieldsToggleMenu);
        $fieldsToggleButton.find('button').on('click', () => $fieldsToggleMenu.trigger('_toggle') );

        // export button
        let $export_button = $('<div/>').addClass('sb-view-header-list-fields_toggle mdc-menu-surface--anchor')
            .append( UIHelper.createButton('selection-action-' + 'SB_ACTIONS_BUTTON_EXPORT', 'export', 'icon', 'save_alt')
                .attr('title', 'export current page')
                .addClass('sb-view-header-list-export_button')
                .on( 'click', (event:any) => {
                    const params = new URLSearchParams({
                        get:        'model_export-xls',
                        view_id:    this.getId(),
                        entity:     this.entity,
                        domain:     JSON.stringify(this.getDomain()),
                        id:         (this.selected_ids.length) ? this.selected_ids[0] : 0,
                        ids:        JSON.stringify(this.selected_ids),
                        lang:       this.lang,
                        controller: this.controller,
                        params:     JSON.stringify(this.getParams())
                    }).toString();
                    window.open(this.getEnv().backend_url + '?' + params, "_blank");
                })
            );

        // pagination controls
        let $pagination = UIHelper.createPagination().addClass('sb-view-header-list-pagination');

        let $refreshListButton = UIHelper.createButton('refresh-view', 'refresh', 'icon', 'refresh').on('click', () => this.onchangeView());

        $pagination.find('.pagination-container')
            .prepend( $refreshListButton );


        let $paginationTotal = $pagination.find('.pagination-total');

        if(header_layout != 'full') {
            $paginationTotal.hide();
        }

        $paginationTotal
            .append( $('<span class="sb-view-header-list-pagination-start"></span>') ).append( $('<span />').text('-') )
            .append( $('<span class="sb-view-header-list-pagination-end"></span>') ).append( $('<span />').text(' / ') )
            .append( $('<span class="sb-view-header-list-pagination-total"></span>') );

        let $paginationNavigation = $pagination.find('.pagination-navigation');

        if(header_layout == 'full') {
            $paginationNavigation.append(
                UIHelper.createButton('pagination-first_' + this.getUuid(), '', 'icon', 'first_page').addClass('sb-view-header-list-pagination-first_page')
                .on('click', (event: any) => {
                    this.paginationAction('first');
                })
            );
        }

        $paginationNavigation.append(
                UIHelper.createButton('pagination-prev_' + this.getUuid(), '', 'icon', 'chevron_left').addClass('sb-view-header-list-pagination-prev_page')
                .on('click', (event: any) => {
                    this.paginationAction('prev');
                })
            );

        $paginationNavigation.append(
                UIHelper.createButton('pagination-next_' + this.getUuid(), '', 'icon', 'chevron_right').addClass('sb-view-header-list-pagination-next_page')
                .on('click', (event: any) => {
                    this.paginationAction('next');
                })
            );

        if(header_layout == 'full') {
            $paginationNavigation.append(
                UIHelper.createButton('pagination-last_' + this.getUuid(), '', 'icon', 'last_page').addClass('sb-view-header-list-pagination-last_page')
                .on('click', (event: any) => {
                    this.paginationAction('last');
                })
            );
        }

        if(header_layout == 'full') {
            let $select = UIHelper.createPaginationSelect('pagination-select_' + this.getUuid(), '', [5, 10, 25, 50, 100, 500], this.limit).addClass('sb-view-header-list-pagination-limit_select');

            $pagination.find('.pagination-rows-per-page')
                .append($select);

            $select.find('input').on('change', (event: any) => {
                let $this = $(event.currentTarget);
                this.setLimit(<number>$this.val());
                this.setStart(0);
                this.onchangeView();
            });
        }

        if(this.config.show_filter) {
            $level2.append( $filters_button );
            // add quick search if not prevented by view schema
            if(!this.config.header.hasOwnProperty('filters') || !this.config.header.filters.hasOwnProperty('quicksearch') || this.config.header.filters.quicksearch) {
                $level2.append( $filters_search );
            }
            $level2.append( $filters_set );
            // show pre-applied filters (@see init())
            for(let filter_id of this.applied_filters_ids) {
                this.showFilter(filter_id);
            }
        }

        if(header_layout !== 'full') {
            $level2.append( $('<div class="sb-view-header-actions-inline"></div>') );
        }

        $level2.append( $pagination );
        $level2.append( $export_button );
        $level2.append( $fieldsToggleButton );

        if(header_layout !== 'full') {
            $level2.prepend($std_actions_inline);
        }

        this.$headerContainer.append( $elem );
    }

    private layoutChartHeader() {
        console.debug('View::layoutChartHeader');

        // append header structure
        this.$headerContainer.append(' \
            <div class="sb-view-header-list"> \
                <div class="sb-view-header-actions"></div> \
                <div class="sb-view-header-advanced"></div> \
                <div class="sb-view-header-list-navigation"></div> \
            </div>'
        );

        let $elem = this.$headerContainer.find('.sb-view-header-list');

        let $actions_set = $elem.find('.sb-view-header-actions');
        let $level1 = $elem.find('.sb-view-header-advanced');
        let $level2 = $elem.find('.sb-view-header-list-navigation');

        // left side : standard actions for views
        let $std_actions = $('<div />').addClass('sb-view-header-actions-std').appendTo($actions_set);
        // right side : the actions specific to the view, and depending on object status
        let $view_actions = $('<div />').addClass('sb-view-header-actions-view').appendTo($actions_set);

        // append advanced layout if requested
        if(this.hasAdvancedFilters()) {
            $elem.addClass('has-advanced-filters');
            let $layout = $('<div class="sb-view-header-advanced-layout" />').appendTo($level1);

            let view = new View(this.getContext(), this.controller.replace(/_/g, '\\'), 'search', 'default', this.getDomain(), 'edit', 'widget', this.lang, {});
            view.isReady().then( () => {
                let $container = view.getContainer();
                $layout.append($container);
                // detect view submission / change
                view.addSubscriber(['change'], async () => {
                    // retrieve model of the view
                    let model = view.getModel();
                    let objects = await model.get();
                    let object:any = objects[0];
                    // inject object as part of parent View's body for the Model service
                    for(let field in object) {
                        let value = object[field];
                        if(typeof value == 'object' && value !== null) {
                            value = value.id;
                        }
                        this.params[field] = value;
                    }
                    // trigger a refresh of the current view
                    this.onchangeView();
                });

            });

        }

        let $advanced_filters_button =
        $('<div/>').addClass('sb-view-header-list-advanced-filters-button')
        .append( UIHelper.createButton(this.getUuid()+'-advanced-filters', 'filters', 'icon', 'chevron_right') ).prependTo($level1);

        $advanced_filters_button.on('click', () => {
            $elem.toggleClass('is-advanced-open');
            let head_height = this.$headerContainer.height();
            this.$layoutContainer.css({height: 'calc(100% - '+head_height+'px)'});
        });

        // container for holding chips of currently applied filters
        let $filters_set = $('<div />').addClass('sb-view-header-list-filters-set mdc-chip-set').attr('role', 'grid');

        // fields toggle menu : button for displaying the filters menu
        let $filters_button =
        $('<div/>').addClass('sb-view-header-list-filters mdc-menu-surface--anchor')
        .append( UIHelper.createButton('view-filters', 'filters', 'icon', 'filter_list') );

        // create floating menu for filters selection
        let $filters_menu = UIHelper.createMenu('filters-menu').addClass('sb-view-header-list-filters-menu').appendTo($filters_button);
        let $filters_list = UIHelper.createList('filters-list').appendTo($filters_menu);

        // generate filters list
        for(let filter_id in this.filters) {
            let filter = this.filters[filter_id];

            UIHelper.createListItem(filter_id, filter.description)
            .appendTo($filters_list)
            .on('click', (event) => {
                this.applyFilter(filter_id);
            });
        }

        // append additional option for custom filter
        if(Object.keys(this.filters).length) {
            UIHelper.createListDivider().appendTo($filters_list);
        }

        if(this.config.show_filter) {
            $level2.append( $filters_button );

            $level2.append( $filters_set );
            // show pre-applied filters (@see init())
            for(let filter_id of this.applied_filters_ids) {
                this.showFilter(filter_id);
            }
        }

        // pagination controls
        let $pagination = UIHelper.createPagination().addClass('sb-view-header-list-pagination');

        let $refresh_list_button = UIHelper.createButton(this.getUuid()+'-refresh-view', 'refresh', 'icon', 'refresh').on('click', () => this.onchangeView());

        let $switch_grid_button = UIHelper.createButton(this.getUuid()+'switch-view', 'refresh', 'icon', 'list').on('click', () => {
            this.setMode('grid');
            this.$layoutContainer.removeClass('sb-view-layout-chart');
            this.$layoutContainer.addClass('sb-view-layout-list');
            this.onchangeView(true);
            $switch_grid_button.hide();
            $switch_chart_button.show();
        }).hide();

        let $switch_chart_button = UIHelper.createButton(this.getUuid()+'switch-view', 'refresh', 'icon', 'bar_chart').on('click', () => {
            this.setMode('chart');
            this.$layoutContainer.removeClass('sb-view-layout-list');
            this.$layoutContainer.addClass('sb-view-layout-chart');
            this.onchangeView(true);
            $switch_chart_button.hide();
            $switch_grid_button.show();
        });

        let modes = ['chart', 'grid'];
        if(this.config.header.hasOwnProperty('modes')) {
            modes = this.config.header.modes;
        }
        if(modes.includes('chart')) {
            $pagination.find('.pagination-container').prepend( $switch_chart_button );
        }
        if(modes.includes('grid')) {
            $pagination.find('.pagination-container').prepend( $switch_grid_button );
        }
        $pagination.find('.pagination-container').prepend( $refresh_list_button );

        $level2.append( $pagination );

        this.$headerContainer.append( $elem );
    }

    /**
     * Re-draw the list layout.
     * This method is triggered by a model change @see layoutRefresh() or a selection change @see onChangeSelection().
     *
     * @param full
     */
    private layoutListRefresh(full: boolean = false) {
        console.debug('View::layoutListRefresh', full);
        // update footer indicators (total count)
        let limit: number = this.getLimit();
        let total: number = this.getTotal();
        let start: number = (total) ? (this.getStart() + 1) : 0;
        let end: number = start + limit - 1;
        end = (total) ? Math.min(end, start + this.model.ids().length - 1) : 0;

        const header_layout = this.config.header?.layout ?? 'full';
        const header_exports_disabled = ( typeof this.config.header?.exports === 'boolean' && !this.config.header.exports );

        this.$headerContainer.find('.sb-view-header-list-pagination-total').html(total);
        this.$headerContainer.find('.sb-view-header-list-pagination-start').html(start);
        this.$headerContainer.find('.sb-view-header-list-pagination-end').html(end);

        this.$headerContainer.find('.sb-view-header-list-pagination-first_page').prop('disabled', !(start > limit));
        this.$headerContainer.find('.sb-view-header-list-pagination-prev_page').prop('disabled', !(start > limit));
        this.$headerContainer.find('.sb-view-header-list-pagination-next_page').prop('disabled', !(start <= total-limit));
        this.$headerContainer.find('.sb-view-header-list-pagination-last_page').prop('disabled', !(start <= total-limit));

        this.$headerContainer.find('.sb-view-header-list-export_button').prop('disabled', !(total > 0));

        let $action_set = this.$headerContainer.find('.sb-view-header-actions');
        let $std_actions = $action_set.find('.sb-view-header-actions-std');

        // abort any pending edition
        let $actions_selected_edit = this.$headerContainer.find('.sb-view-header-list-actions-selected-edit');
        if($actions_selected_edit.length) {
            this.$headerContainer.find('.action-selected-edit-cancel').trigger('click');
        }
        // remove containers related to selection actions
        this.$headerContainer.find('.sb-view-header-list-actions-selected-edit').remove();
        this.$headerContainer.find('.sb-view-header-list-actions-selected').remove();

        // #todo - is this still used ?
        $action_set.find('.sb-view-header-list-actions-export').remove();

        // do not show the actions menu for 'add' and 'select' purposes
        if(['view', 'widget'].indexOf(this.purpose) > -1) {
            if(this.purpose == 'view' && !header_exports_disabled) {
                // create export menu (always visible: no selection means "export all")
                let $export_actions_menu_button = $('<div />').addClass('sb-view-header-list-actions-export mdc-menu-surface--anchor')
                    .append(UIHelper.createButton('selection-action-' + 'SB_ACTIONS_BUTTON_EXPORT', 'export', 'icon', 'file_download'))
                    .appendTo($std_actions);

                let $export_actions_menu = UIHelper.createMenu('export-actions-menu').addClass('sb-view-header-list-export-menu').appendTo($export_actions_menu_button);
                let $export_actions_list = UIHelper.createList('export-actions-list').appendTo($export_actions_menu);

                // generate filters list
                for(let export_id in this.exports) {
                    let item = this.exports[export_id];

                    let export_title = TranslationService.resolve(this.translation, 'view', [this.getId(), 'exports'], item.id, item.label, 'label')
                    UIHelper.createListItem('SB_ACTIONS_BUTTON_EXPORT-' + item.id, export_title, item.hasOwnProperty('icon') ? item.icon : '')
                    .on( 'click', (event:any) => {
                        const params = new URLSearchParams({
                            get:        item.controller,
                            view_id:    (item.view) ? item.view : this.getId(),
                            entity:     this.entity,
                            domain:     JSON.stringify(this.getDomain()),
                            lang:       this.lang,
                            controller: this.controller,
                            // enforce nolimit
                            nolimit:    'true',
                            params:     JSON.stringify(this.getParams())
                        }).toString();
                        window.open(this.getEnv().backend_url + '?' + params, "_blank");
                    })
                    .appendTo($export_actions_list);

                }

                UIHelper.decorateMenu($export_actions_menu);
                $export_actions_menu_button.find('button').on('click', () => $export_actions_menu.trigger('_toggle') );
            }

            // create buttons with actions to apply on current selection
            if(this.selected_ids.length > 0) {
                let $container = $('<div />').addClass('sb-view-header-list-actions-selected')

                if(header_layout === 'full') {
                    $container.appendTo($std_actions);
                }
                else {
                    $container.appendTo(this.$headerContainer.find('.sb-view-header-actions-inline'));
                }

                let count = this.selected_ids.length;

                let $fields_toggle_button = $('<div/>').addClass('mdc-menu-surface--anchor')
                    .append( UIHelper.createButton('action-selected', count + ' ' + TranslationService.instant('SB_ACTIONS_BUTTON_SELECTED'), 'outlined') );

                let $list = UIHelper.createList('fields-list');
                let $menu = UIHelper.createMenu('fields-menu').addClass('sb-view-header-list-fields_toggle-menu');

                $menu.append($list);
                $fields_toggle_button.append($menu);

                // add actions defined in view
                console.debug('View::LayoutListRefresh - Adding selection actions', this.config.selection_actions);
                for(let item of this.config.selection_actions) {
                    let item_id = 'SB_ACTION_ITEM-' + item.label;
                    // #todo #temp - attempt to translate with label as being a SB_ constant (we should only rely on ID instead)
                    let translated_label = TranslationService.instant(item.label);

                    // look for a translation based on id
                    if(item.hasOwnProperty('id') && translated_label == item.label) {
                        item_id = 'SB_ACTION_ITEM-' + item.id;
                        translated_label = TranslationService.resolve(this.translation, 'view', [this.getId(), 'header', 'selection', 'actions'], item.id, item.label);
                    }
                    let $list_item = UIHelper.createListItem(item_id, translated_label, item.icon)
                        .on('click', (event: any) => item.handler(this.selected_ids, item) )
                        .appendTo($list);

                    if(item.hasOwnProperty('primary') && item.primary) {
                        $container.append(UIHelper.createButton('selection-action-' + item.label, item.label, 'icon', item.icon).on('click', (event:any) => item.handler(this.selected_ids, item)));
                        let $tooltip = UIHelper.createTooltip('selection-action-' + item.label, TranslationService.instant(item.label));
                        $container.append($tooltip);
                        UIHelper.decorateTooltip($tooltip);
                    }
                    if(item.hasOwnProperty('visible')) {
                        if(!item.visible) {
                            $list_item.hide();
                        }
                    }
                }

                UIHelper.decorateMenu($menu);
                $fields_toggle_button.find('button').on('click', () => $menu.trigger('_toggle') );
                $fields_toggle_button.appendTo($container);
            }

        }

        this.layout.loading(false);
    }

    private layoutChartRefresh(full: boolean = false) {
        console.debug('View::layoutChartRefresh', full);
        // update footer indicators (total count)

        let $action_set = this.$headerContainer.find('.sb-view-header-actions');
        let $std_actions = $action_set.find('.sb-view-header-actions-std');

        // remove containers related to selection actions
        $action_set.find('.sb-view-header-list-actions-export').remove();

        // do not show the actions menu for 'add' and 'select' purposes
        if(['view', 'widget'].indexOf(this.purpose) > -1) {
            if(this.purpose == 'view') {
                // create export menu (always visible: no selection means "export all")
                let $export_actions_menu_button = $('<div/>').addClass('sb-view-header-list-actions-export mdc-menu-surface--anchor')
                .append(UIHelper.createButton('selection-action-' + 'SB_ACTIONS_BUTTON_EXPORT', 'export', 'icon', 'file_download'))
                .appendTo($std_actions);

                let $export_actions_menu = UIHelper.createMenu('export-actions-menu').addClass('sb-view-header-list-export-menu').appendTo($export_actions_menu_button);
                let $export_actions_list = UIHelper.createList('export-actions-list').appendTo($export_actions_menu);

                // generate filters list
                // #memo - for charts there is only one export (export-chart-xls)
                for(let export_id in this.exports) {
                    let item = this.exports[export_id];

                    let export_title = TranslationService.resolve(this.translation, 'view', [this.getId(), 'exports'], item.id, item.label, 'label')
                    UIHelper.createListItem('SB_ACTIONS_BUTTON_EXPORT-' + item.id, export_title, item.hasOwnProperty('icon') ? item.icon : '')
                    .on( 'click', (event: any) => {
                        const params = new URLSearchParams({
                                get:        item.controller,
                                entity:     this.entity,
                                view_id:    (item.view) ? item.view : this.getId(),
                                domain:     JSON.stringify(this.getDomain()),
                                lang:       this.lang,
                                params:     JSON.stringify(this.getParams())
                        }).toString();
                        window.open(this.getEnv().backend_url + '?' + params, "_blank");
                    })
                    .appendTo($export_actions_list);
                }

                UIHelper.decorateMenu($export_actions_menu);
                $export_actions_menu_button.find('button').on('click', () => $export_actions_menu.trigger('_toggle') );
            }


        }

        this.layout.loading(false);
    }

    private layoutFormHeader() {
        console.debug('View::layoutFormHeader');

        let $elem = $('<div />').addClass('sb-view-header-form');

        // container for holding chips of currently applied filters
        let $actions_set = $('<div />').addClass('sb-view-header-actions').appendTo($elem);

        // left side : standard actions for views
        let $std_actions = $('<div />').addClass('sb-view-header-actions-std').appendTo($actions_set);
        // right side : the actions specific to the view, and depending on object status
        let $view_actions = $('<div />').addClass('sb-view-header-actions-view').appendTo($actions_set);

        // possible values for header.actions
        /*
            "ACTION.CREATE":   [],
            "ACTION.SELECT":   [],
            "ACTION.EDIT":     [],
            "ACTION.SAVE":     [
                {"id": "SAVE_AND_CLOSE"},                           // save and go back to list [edit] or parent context [create] (default)
                {"id": "SAVE_AND_VIEW"},                            // save and go back to view mode [edit] or list [create]
                {"id": "SAVE_AND_EDIT", "view": "form.default"},    // save and reopen a view in edit mode, change view if defined
                {"id": "SAVE_AND_CONTINUE"}                         // save and remain in edit mode
            ],
            "ACTION.CANCEL":   [
                {"id": "CANCEL_AND_CLOSE"},     // do not save and go back to list
                {"id": "CANCEL_AND_VIEW"}       // do not save and go back to view mode
            ]
        */
        // default order for header actions split buttons (can be overridden in view files)
        let default_header_actions: any = {
            "ACTION.EDIT":     [],
            "ACTION.SAVE":     [ {"id": "SAVE_AND_CLOSE"} ],
            "ACTION.CANCEL":   [ {"id": "CANCEL_AND_CLOSE"} ]
        };

        const header_layout = ( (this.config.header?.layout ?? 'full') === 'inline') ? 'inline' : 'full';
        const header_actions_disabled = ( typeof this.config.header?.actions === 'boolean' && !this.config.header.actions );

        let header_actions: any = {};

        // overwrite with view schema, if defined
        if(this.custom_actions.hasOwnProperty('ACTION.SAVE')) {
            header_actions['ACTION.SAVE'] = this.custom_actions['ACTION.SAVE'];
        }
        else {
            header_actions['ACTION.SAVE'] = default_header_actions['ACTION.SAVE'];
        }
        if(this.custom_actions.hasOwnProperty('ACTION.CANCEL')) {
            header_actions['ACTION.CANCEL'] = this.custom_actions['ACTION.CANCEL'];
        }
        else {
            header_actions['ACTION.CANCEL'] = default_header_actions['ACTION.CANCEL'];
        }

        let has_action_save = !header_actions_disabled && this.isActionEnabled(header_actions['ACTION.SAVE'], this.mode);
        let has_action_cancel = !header_actions_disabled && this.isActionEnabled(header_actions['ACTION.CANCEL'], this.mode);
        let has_action_update = !header_actions_disabled && this.isActionEnabled(this.config?.header?.actions?.['ACTION.EDIT'] ?? true, this.mode);

        // overlay to cover the buttons and prevent additional click while action is processing
        let $disable_overlay = $('<div />').addClass('disable-overlay');
        $actions_set.append($disable_overlay);

        switch(this.mode) {
            case 'view':
                if(has_action_update && header_layout === 'full') {
                    $std_actions
                    .append(
                        UIHelper.createButton(this.uuid + '_action-edit', TranslationService.instant('SB_ACTIONS_BUTTON_UPDATE'), 'raised')
                        .on('click', async () => {
                            // #todo - allow overloading default action controller ('ACTION.EDIT')
                            await this.openContext({
                                entity: this.entity, type: this.type, name: this.name, domain: this.getDomain(), mode: 'edit', purpose: 'update',
                                // for UX consistency, inject current view widget context (currently selected tabs, ...)
                                selected_sections: this.layout.getSelectedSections()
                            });
                        })
                    );
                }
                break;
            case 'edit':

                // define the save method (used for all action implying saving the object)
                const save_method = async (action:any) => {
                    let objects;
                    if(!this.layout.checkRequiredFields()) {
                        let $snack = UIHelper.createSnackbar(TranslationService.instant('SB_ERROR_MISSING_PARAM', 'Missing value.'), TranslationService.instant('SB_ERROR_ERROR', 'Error'), '', 4000);
                        this.$container.append($snack);
                        return null;
                    }
                    // #memo - while inline editing, we must send the full object
                    if(this.purpose == 'create') {
                        // get the full collection, whatever the changes made by user
                        objects = await this.model.get();
                    }
                    else {
                        // get changed objects only
                        objects = this.model.getChanges();
                    }
                    if(!objects.length) {
                        // no change : nothing to do
                        return {};
                    }
                    else {
                        // we're in edit mode for single object (form)
                        let object = objects[0];
                        let controller = (action && action.hasOwnProperty('controller')) ? action.controller : 'model_update';
                        try {
                            // update new object using the resulting controller
                            const response = await ApiService.call("?do=" + controller, {
                                    entity: this.getEntity(),
                                    ids: [object['id']],
                                    fields: this.model.export(object),
                                    force: false,
                                    lang: this.getLang()
                                });
                            if(response && response.length) {
                                // merge object with response (state and name fields might have changed)
                                object = {...object, ...response[0]};
                            }
                            // remove any beforeunload callback that might have been installed (no change pending anymore)
                            window.removeEventListener('beforeunload', window.beforeUnloadListener);
                            return {selection: [object.id], objects: [object]};
                        }
                        catch(response) {
                            try {
                                // #memo - we must display snack for situations where onupdate fails
                                const res = await this.displayErrorFeedback(this.translation, response, object, true);
                                if(res !== false) {
                                    return {selection: [object.id], objects: [object]};
                                }
                            }
                            catch(error) {
                                console.log('unexpected error: unable to display error feedback', error);
                            }
                        }
                    }
                    return null;
                };

                const save_actions:any = {
                    "SAVE_AND_CONTINUE": async (action:any) => {
                        let res:any = await save_method(action);
                        if(res && res.selection) {
                            let object_id = res.selection.pop();
                            // reset domain (drop state=draft condition)
                            let tmpDomain = new Domain(["id", "=", object_id]);
                            this.domain = tmpDomain.toArray();
                            // feedback the user (since we're not closing the context)
                            let $snack = UIHelper.createSnackbar(TranslationService.instant('SB_ACTIONS_NOTIFY_CHANGES_SAVED', 'Changes saved.'), '', '', 4000);
                            this.$container.append($snack);
                            // refresh the layout since the content might have been changed server side
                            // #memo - only changed fields are sent, so we must reinject current content
                            // let objects = await this.model.get();
                            // this.onchangeViewModel([object_id], {...res.objects[0], ... objects[0]}, true);
                            // #todo - we need to reload all subfields (trigger onchangeView on sub-views)
                            // #memo - for now, we use this, but it resets the whole view and loses the current tab
                            this.onchangeView(true);
                        }
                    },
                    "SAVE_AND_VIEW": async (action:any) => {
                        let res:any = await save_method(action);
                        if(res) {
                            // mark context as changed to refresh parent lists or views showing deleted object
                            this.setChanged();
                            let parent = this.context.getParent();
                            // if context has a parent, close and relay new object_id to parent view
                            if(Object.keys(parent).length && this.purpose != 'create') {
                                await this.closeContext(res);
                            }
                            // if there's no parent or if we're creating a new object, silently close and instantiate a new context
                            else {
                                await this.closeContext(null, true);
                                let object_id = res.selection[0];
                                let view_name = this.name;
                                let view_type = this.type;
                                if(action.hasOwnProperty('view')) {
                                    let parts = action.view.split('.');
                                    if(parts.length) view_type = <string>parts.shift();
                                    if(parts.length) view_name = <string>parts.shift();
                                }
                                await this.openContext({entity: this.entity, type: view_type, name: view_name, domain: ['id', '=', object_id], mode: 'view', purpose: 'view'});
                            }
                        }
                    },
                    "SAVE_AND_EDIT": async (action:any) => {
                        let res:any = await save_method(action);
                        if(res) {
                            // mark context as changed to refresh parent lists or views showing deleted object
                            this.setChanged();
                            await this.closeContext(null, true);
                            let object_id = res.selection[0];
                            let view_name = this.name;
                            let view_type = this.type;
                            if(action.hasOwnProperty('view')) {
                                let parts = action.view.split('.');
                                if(parts.length) view_type = <string>parts.shift();
                                if(parts.length) view_name = <string>parts.shift();
                            }
                            await this.openContext({entity: this.entity, type: view_type, name: view_name, domain: ['id', '=', object_id], mode: 'edit', purpose: 'update'});
                        }
                    },
                    "SAVE_AND_CLOSE": async (action:any) => {
                        let res:any = await save_method(action);
                        if(res) {
                            // mark context as changed to refresh parent lists or views showing deleted object
                            this.setChanged();
                            // relay new object_id to parent view
                            await this.closeContext(res);
                            // close parent as well if current view was the edit mode of parent view (same entity)
                            let parent = this.context.getParent();
                            if(typeof parent.getView === 'function' && parent.getView().getMode() == "view" && this.purpose == 'update' && this.getEntity() == parent.getView().getEntity()) {
                                await this.closeContext();
                            }
                        }
                    }
                };

                let $cancel_button = UIHelper.createButton(this.uuid + '_action-cancel', TranslationService.instant('SB_ACTIONS_BUTTON_CANCEL'), 'outlined');

                $cancel_button.on('click', async () => {
                    let validation = true;
                    if(this.hasChanged() && this.getMode() === 'edit') {
                        validation = confirm(TranslationService.instant('SB_ACTIONS_MESSAGE_ABANDON_CHANGE'));
                    }
                    if(validation) {
                        await this.closeContext();
                    }
                });

                let $save_button = $();

                if(!Array.isArray(header_actions["ACTION.SAVE"])) {
                    header_actions["ACTION.SAVE"] = default_header_actions["ACTION.SAVE"];
                }

                if(header_actions["ACTION.SAVE"].length <= 1) {
                    let save_button_title_id = 'SB_ACTIONS_BUTTON_SAVE';
                    /*
                    if(header_actions["ACTION.SAVE"].length) {
                        save_button_title_id = 'SB_ACTIONS_BUTTON_' + header_actions["ACTION.SAVE"][0].id;
                    }
                    */
                    $save_button = UIHelper.createButton(this.uuid + '_action-save', TranslationService.instant(save_button_title_id), 'raised', '', 'secondary');
                }
                else {
                    $save_button = UIHelper.createSplitButton(this.uuid + '_action-save', TranslationService.instant('SB_ACTIONS_BUTTON_' + header_actions["ACTION.SAVE"][0].id), 'raised', '', 'secondary');
                    for(let i = 1, n = header_actions["ACTION.SAVE"].length; i < n; ++i) {
                        // retrieve order in which actions must be invoked
                        let header_action = header_actions["ACTION.SAVE"][i].id;
                        if(!save_actions.hasOwnProperty(header_action)) {
                            continue;
                        }
                        let save_action = save_actions[header_action];
                        $save_button.find('.menu-list').append(
                            UIHelper.createListItem(this.uuid + '_action-' + header_action, TranslationService.instant('SB_ACTIONS_BUTTON_' + header_action))
                            // onclick, save and stay in edit mode (save and go back to list)
                            .on('click', (event: any) => {
                                console.debug('View::layoutFormHeader>$save_button[' + i + '].onclick');
                                // prevent propagation to parent container
                                event.stopPropagation();
                                event.stopImmediatePropagation();
                                // #memo - delay action so that widgets onchange handlers are processed
                                setTimeout( async () => {
                                    try {
                                        // disable header buttons
                                        $disable_overlay.show();
                                        // show loader
                                        this.layout.loading(true);
                                        await save_action(header_actions["ACTION.SAVE"][i]);
                                        // hide loader (instant)
                                        this.layout.loading(false);
                                        // delay 2 seconds after response before re-enabling
                                        setTimeout( () => $disable_overlay.hide(), 2000);
                                    }
                                    catch(error) {
                                        console.warn(error);
                                    }
                                }, 100);
                            })
                        );
                    }
                }

                // assign action on base button
                let header_action = header_actions["ACTION.SAVE"][0].id;
                if(save_actions.hasOwnProperty(header_action)) {
                    let save_action = save_actions[header_action];
                    $save_button.on('click', async (event: any) => {
                        console.debug('View::layoutFormHeader>$save_button.onclick');
                        // prevent propagation to children buttons, if any
                        event.stopPropagation();
                        event.stopImmediatePropagation();
                        event.preventDefault();

                        // #memo - delay action so that widgets onchange handlers are processed
                        setTimeout( async () => {
                            try {
                                // disable header buttons
                                $disable_overlay.show();
                                // show loader
                                this.layout.loading(true);
                                await save_action(header_actions["ACTION.SAVE"][0]);
                                // hide loader (instant)
                                this.layout.loading(false);
                                // delay 2 seconds after response before re-enabling
                                setTimeout( () => $disable_overlay.hide(), 2000);
                            }
                            catch(error) {
                                console.warn(error);
                            }
                        }, 100);
                    });
                }

                if(!has_action_save) {
                    $save_button.hide();
                }

                if(!has_action_cancel) {
                    $cancel_button.hide();
                }

                $std_actions
                    .append($save_button)
                    .append($cancel_button);
                break;
        }

        // attach elements to header toolbar
        this.$headerContainer.append( $elem );
    }


    private async layoutRefresh(full: boolean = false) {
        console.debug('View::layoutRefresh', full);
        await this.layout.refresh(full);
        if(['list', 'cards'].indexOf(this.type) >= 0) {
            this.layoutListRefresh(full);
        }
        if(['chart'].indexOf(this.type) >= 0) {
            this.layoutChartRefresh(full);
        }

    }

    private decorateBulkAssignDialog($dialog: JQuery) {
        let $elem = $('<div />');

        let selected_field:string = '';
        let selected_value:any = '';

        let $select_field = $();
        let $select_value = $();

        $dialog.on('_open', () => {
            $select_field.find('input').trigger('change');
        });

        let fields:any = {};

        for(let item of this.view_schema.layout.items ) {
            let label = (item.hasOwnProperty('label'))?item.label:item.value;
            fields[item.value] = TranslationService.resolve(this.translation, 'model', [], item.value, label, 'label');
        }

        $select_field = UIHelper.createSelect('bulk-assign-select-field_' + this.getUuid(), TranslationService.instant('SB_FILTERS_DIALOG_FIELD'), fields, Object.keys(fields)[0]).appendTo($elem);

        // setup handler for relaying value update to parent layout
        $select_field.find('input')
        .on('change', (event) => {
            let $this = $(event.currentTarget);
            selected_field = <string> $this.val();

            $elem.find('#bulk-assign-select-value_' + this.getUuid()).remove();

            let field_type = this.model.getFinalType(selected_field);

            switch(field_type) {
                case 'boolean':
                    $select_value = UIHelper.createSelect('bulk-assign-select-value_' + this.getUuid(), TranslationService.instant('SB_FILTERS_DIALOG_VALUE'), ['true', 'false']);
                    $select_value.find('input').on('change', (event) => {
                        let $this = $(event.currentTarget);
                        selected_value = ($this.children("option:selected").val() == 'true');
                    });
                    break;
                case 'date':
                case 'datetime':
                    // daterange selector
                    $select_value = UIHelper.createInput('bulk-assign-select-value_' + this.getUuid(), TranslationService.instant('SB_FILTERS_DIALOG_VALUE'), '');

                    let locale: string = 'en';
                    if(this.config.locale) {
                        locale = this.config.locale.slice(0, 2);
                    }

                    $select_value.find('input').datepicker({
                        ...jqlocale[locale],
                        onClose: () => {
                            $select_value.find('input').trigger('focus');
                        }
                    })
                    .on('change', (event:any) => {
                        // update widget value using jQuery `getDate`
                        let $this = $(event.currentTarget);
                        let date = $this.datepicker('getDate');
                        selected_value = date;
                    });
                    break;
                case 'many2one':
                // #todo - select amongst existing objects typeahead
                case 'string':
                // #todo - display selection if any
                case 'integer':
                case 'float':
                default:
                    $select_value = UIHelper.createInput('bulk-assign-select-value_' + this.getUuid(), TranslationService.instant('SB_FILTERS_DIALOG_VALUE'), '');
                    $select_value.find('input').on('change', (event) => {
                        let $this = $(event.currentTarget);
                        selected_value = <string> $this.val();
                    });
            }

            $elem.append($select_value);
        })
        // init
        .trigger('change');


        $dialog.find('.mdc-dialog__content').append($elem);

        $dialog.on('_accept', () => {
            // assign value to currently selected items
            for(let object_id of this.selected_ids) {
                this.$layoutContainer.find('tr[data-id="' + object_id + '"]').trigger('_setValue', [selected_field, selected_value]);
            }
        });

    }

    private decorateCustomFilterDialog($dialog: JQuery) {
        let $elem = $('<div />');

        let selected_field:string = '';
        let selected_operator:string = '';
        let selected_value:any = '';

        let $select_field = $();
        let $select_operator = $();
        let $select_value = $();

        /*
        $dialog.on('_open', () => {
            $select_field.find('input').trigger('change');
        });
        */

        let fields:any = {};
        const filterable_types = ['integer', 'float', 'boolean', 'string', 'date', 'time', 'datetime', 'many2one'];

        for(let item of this.view_schema.layout.items ) {
            let field = item.value;
            let field_type: string | null = this.model.getFinalType(field);
            if(field_type && this.model_schema.fields.hasOwnProperty(field) && filterable_types.indexOf(field_type) >= 0) {
                let label = (item.hasOwnProperty('label'))?item.label:field;
                fields[field] = TranslationService.resolve(this.translation, 'model', [], field, label, 'label');
            }
        }

        $select_field = UIHelper.createSelect('custom-filter-select-field_' + this.getUuid(), TranslationService.instant('SB_FILTERS_DIALOG_FIELD'), fields, Object.keys(fields)[0]).appendTo($elem);
        // setup handler for relaying value update to parent layout
        $select_field.addClass('dialog-select');
        $select_field.find('input').first()
            .on('change', (event) => {
                console.debug('CustomFilterDialog: received change on input select_field - updating widgets');
                let $this = $(event.currentTarget);
                selected_field = <string> $this.val();

                $elem.find('#custom-filter-select-operator_' + this.getUuid()).remove();
                $elem.find('.sb-widget').remove();

                let field_type: string | null = this.model.getFinalType(selected_field);
                let operators: any[] = this.model.getOperators(field_type ?? 'string');
                selected_operator = operators[0];
                $select_operator = UIHelper.createSelect('custom-filter-select-operator_' + this.getUuid(), TranslationService.instant('SB_FILTERS_DIALOG_OPERATOR'), operators, operators[0]);
                // setup handler for relaying value update to parent layout
                $select_operator.addClass('dialog-select').find('input').first()
                    .on('change', (event) => {
                        console.debug('CustomFilterDialog: received change on input select_operator - updating widgets');
                        let $this = $(event.currentTarget);
                        selected_operator = <string> $this.val();
                    });

                $select_operator.trigger('select', operators[0]);

                let config = WidgetFactory.getWidgetConfig(this, selected_field, this.translation, this.model_fields, this.view_fields);
                // form form layout
                config.layout = 'form';

                let value:any = '';
                if(['date', 'datetime'].indexOf(config.type) >= 0) {
                    value = new Date();
                    selected_value  = value.toISOString();
                }
                else if(['one2many', 'many2one', 'many2many'].indexOf(config.type) >= 0) {
                    // limit relational widgets to direct selection only
                    config.has_action_create = false;
                    config.has_action_open = false;
                    config.has_action_select = false;
                }
                let widget:Widget = WidgetFactory.getWidget(this.layout, config.type, fields[selected_field], value, config);
                widget.setMode('edit');
                widget.setReadonly(false);

                $select_value = widget.render();
                $select_value.on('_updatedWidget', (event:any) => {
                    // relay the value whatever the type (m2o handling will be done afterwards)
                    selected_value = widget.getValue();
                });
                $elem.append($select_operator);
                $elem.append($select_value);
            });

        $dialog.find('.mdc-dialog__content').append($elem);

        // init
        $select_field.trigger('select', Object.keys(fields)[0]);

        $dialog.on('_accept', async () => {
            let operand = selected_field;
            let operator = selected_operator;
            let value:any = selected_value;

            // handle object as selection
            if(typeof selected_value == 'object' && selected_value !== null && selected_value.hasOwnProperty('id')) {
                value = selected_value.id;
            }

            if(selected_operator == 'like') {
                operator = 'ilike';
                value = '%' + value + '%';
            }
            else if(selected_operator == 'in' || selected_operator == 'not in') {
                value = '[' + value + ']';
            }

            let tmpDomain = new Domain([operand, operator, value]);
            let clause = tmpDomain.getClauses()[0];

            let description = await this.translateFilterClause(clause)
            let filter = {
                "id": "custom_filter_"+(Math.random()+1).toString(36).substring(2, 9),
                "label": "custom filter",
                "description": description,
                "clause": clause.toArray()
            };

            // add filter to View available filters
            this.filters[filter.id] = filter;

            let $filters_list =  this.$headerContainer.find('#filters-list');
            UIHelper.createListItem(filter.id, filter.description)
             .prependTo($filters_list)
             .on('click', (event) => {
                 this.applyFilter(filter.id);
             });

            this.applyFilter(filter.id);
        });

    }

    private decorateDialogDeletionConfirm($dialog: JQuery) {
        let $elem = $('<div />');

        let $consent_confirm = UIHelper.createCheckbox('action-selected-delete-permanent', TranslationService.instant('SB_ACTIONS_DELETION_DIALOG_I_CONFIRM')).appendTo($elem);

        $dialog.find('.mdc-dialog__content').append($elem);

        $dialog.on('_accept', () => {
            $dialog.trigger('_ok', [{confirm: $consent_confirm.find('input').is(":checked")}]);
        });
    }

    private decorateDialogArchiveConfirm($dialog: JQuery) {
        let $elem = $('<div />').text(TranslationService.instant('SB_ACTIONS_ARCHIVE_DIALOG_MESSAGE'));

        $dialog.find('.mdc-dialog__content').append($elem);

        $dialog.on('_accept', () => {
            $dialog.trigger('_ok', []);
        });
    }

    /**
     * Callback for requesting a Model update.
     * Requested from layout when a change occurred in the widgets.
     *
     * @param ids       array   one or more object identifiers
     * @param values    object   map of fields names and their related values
     */
    public async onchangeViewModel(ids: Array<any>, values: object, refresh: boolean = true) {
        console.debug('View::onchangeViewModel', ids, values, refresh);
        if(this.mode === 'edit') {
            // force beforeunload callback, in order to block action if there is unsaved change
            window.addEventListener('beforeunload', window.beforeUnloadListener);
        }
        this.model.change(ids, values);
        // model has changed : forms need to re-check the visibility attributes
        if(refresh) {
            await this.onchangeModel(false);
            // notify (external) subscribers
            for(let event of Object.keys(this.subscribers)) {
                for(let callback of this.subscribers[event]) {
                    if( ({}).toString.call(callback) === '[object Function]') {
                        callback();
                    }
                }
            }
        }
    }

    /**
     * Callback for requesting a Layout update: the widgets in the layout need to be refreshed.
     * Requested from Model when a change occurred in the Collection (as consequence of domain or params update).
     * If `full`is set to true, then the layout is re-generated
     * @param full  boolean
     */
    public async onchangeModel(full: boolean = false) {
        console.debug('View::onchangeModel', full);
        await this.layoutRefresh(full);
    }

    /**
     * Callback for requesting a Model refresh.
     * Request can be issued:
     *   - either from view: domain has been updated,
     *   - or from layout: context has been updated (sort column, sorting order, limit, page, ...)
     */
    public async onchangeView(full: boolean = false, active_index: number = 0) {
        console.debug('View::onchangeView', full);

        if(this.is_inline_editing) {
            // prevent refresh while inline editing
            return;
        }


        // reset selection
        this.selected_ids = [];

        if(['list', 'chart'].includes(this.type)) {
            this.layout.loading(true);
        }

        await this.model.refresh(full);

        // for list View, update `activeObjectId` based on active_index
        if(this.type === 'list') {
            const objects = await this.model.get();
            if(objects[active_index] ?? null) {
                this.setActiveObjectId(objects[active_index].id)
            }
        }

        // #memo - this needs to be done after model change (it case it impacts context header)
        // #memo - this has only effects if the Context was actually changed (domain or else)
        // relay updated context event
        this.updatedContext();
    }

    /**
     * Callback for list selection update.
     *
     * @param selection
     */
    public onchangeSelection(selection: Array<any>) {
        console.debug('View::onchangeSelection', selection);
        this.selected_ids = selection;
        // if inline_edit, force a cancel
        this.$container.find('.sb-view-header-actions-std').find('#action-selected-edit-cancel').trigger('click');
        this.layoutListRefresh();
    }


    private showFilter(filter_id:string) {
        console.debug('View::showFilter', this.filters, this.applied_filters_ids);
        let filter = this.filters[filter_id];
        let $filters_set = this.$headerContainer.find('.sb-view-header-list-filters-set');
        // make sure not to append a chip for same filter twice
        $filters_set.find('#'+filter_id).remove();
        $filters_set.append(
            UIHelper.createChip(filter.description)
            .attr('id', filter_id)
            .on('click', async (event) => {
                // unapply filter
                let $this = $(event.currentTarget)
                await this.unapplyFilter($this.attr('id'));
            })
        );
    }

    /**
     * Apply a filter on the current view, and reload the Collection with the new resulting domain.
     *
     * Expected structure for `filter`:
     *       "id": "lang.french",
     *       "label": "français",
     *       "description": "Utilisateurs parlant français",
     *       "clause": ["language", "=", "fr"]
     */
    private async applyFilter(filter_id: string) {
        this.applied_filters_ids.push(filter_id);
        this.showFilter(filter_id);
        this.setStart(0);
        this.onchangeView();
    }

    private async unapplyFilter(filter_id:any) {

        let index = this.applied_filters_ids.indexOf(filter_id);
        if (index > -1) {
            this.applied_filters_ids.splice(index, 1);
            // #memo - keep filters to allow re-apply while current view is active
            // delete this.filters[filter_id];

            let $filters_set = this.$headerContainer.find('.sb-view-header-list-filters-set');
            $filters_set.find('#'+filter_id).remove();

            if(filter_id == 'filter_search_on_name') {
                // reset value of search input
                this.$headerContainer.find('.sb-view-header-list-filters-search').find('.mdc-text-field__icon').trigger('click');
            }

            this.setStart(0);
            this.onchangeView();
        }
    }

    private async actionSelectionBulkAssign(selection: any) {
        console.debug('View::opening bulk assign dialog');
        this.$container.find('#bulk-assign-dialog_' + this.getUuid()).trigger('_open');
    }

    private async actionSelectionInlineEdit(selection: any) {
        if(selection.length && !this.$container.find('.sb-view-header-list-actions-selected-edit').length) {
            const header_layout = ( (this.config.header?.layout ?? 'full') === 'inline') ? 'inline' : 'full';

            this.$headerContainer.find('#' + 'SB_ACTION_ITEM-' + 'SB_ACTIONS_BUTTON_INLINE_UPDATE').hide();
            this.$headerContainer.find('#' + 'SB_ACTION_ITEM-' + 'SB_ACTIONS_BUTTON_BULK_ASSIGN').show();

            let $action_set = this.$container.find('.sb-view-header-actions-std');

            if(header_layout !== 'full') {
                $action_set = this.$container.find('.sb-view-header-actions-inline');
            }

            let $action_set_selected_edit_actions = $('<div />').addClass('sb-view-header-list-actions-selected-edit');

            let $button_save = UIHelper.createButton(
                    this.uuid + '_action-selected-edit-save',
                    TranslationService.instant('SB_ACTIONS_BUTTON_SAVE'),
                    'raised',
                    '',
                    'secondary'
                )
                .appendTo($action_set_selected_edit_actions);

            let $button_cancel = UIHelper.createButton(
                    this.uuid + '_action-selected-edit-cancel',
                    TranslationService.instant('SB_ACTIONS_BUTTON_CANCEL'),
                    'outlined'
                )
                .appendTo($action_set_selected_edit_actions);

            $action_set.append($action_set_selected_edit_actions);


            $button_save.on('click', () => {
                // wait for the model to be updated and run the action
                setTimeout( () => {
                    // handle changed objects
                    let objects = this.model.getChanges(selection);
                    console.debug('received inline edit button_save:click with changes objects lists : ', selection, objects);

                    let promises = [];

                    for(let object_id of selection) {
                        let promise = new Promise( async (resolve, reject) => {
                            let object = objects.find( o => o.id == object_id );
                            this.$layoutContainer.find('tr[data-id="' + object_id + '"]').each( async (i: number, tr: any) => {
                                let $tr = $(tr);
                                if(!object) {
                                    $tr.trigger('_toggle_mode', 'view');
                                    $tr.attr('data-edit', '0');
                                    resolve(true);
                                }
                                else {
                                    try {
                                        const response = await ApiService.update(this.entity, [object_id], this.model.export(object), false, this.getLang());
                                        $tr.trigger('_toggle_mode', 'view');
                                        $tr.attr('data-edit', '0');
                                        // update the modified field otherwise a confirmation will be displayed at next update
                                        if(Array.isArray(response) && response.length) {
                                            this.model.reset(object_id, response[0]);
                                        }
                                        resolve(true);
                                    }
                                    catch(response) {
                                        try {
                                            const res = await this.displayErrorFeedback(this.translation, response, object, true);
                                            if(res === false ) {
                                                reject();
                                            }
                                            else {
                                                resolve(true);
                                            }
                                        }
                                        catch(response) {
                                            reject();
                                        }
                                    }
                                }
                            });
                        });
                        promises.push(promise);
                    }

                    Promise.all(promises)
                        .then( () => {
                            $action_set_selected_edit_actions.remove();
                            this.$headerContainer.find('#' + 'SB_ACTION_ITEM-' + 'SB_ACTIONS_BUTTON_INLINE_UPDATE').show();
                            this.$headerContainer.find('#' + 'SB_ACTION_ITEM-' + 'SB_ACTIONS_BUTTON_BULK_ASSIGN').hide();
                        })
                        .catch( () => {

                        });
                }, 250);
            });

            $button_cancel.on('click', () => {
                // restore original values for changed objects
                let objects = this.model.getChanges(selection);
                for(let object of objects) {
                    let object_id = object.id;
                    this.$layoutContainer.find('tr[data-id="'+object_id+'"]').each( async (i: number, tr: any) => {
                        let $tr = $(tr);
                        let original = $tr.data('original');
                        for(let field of Object.keys(original)) {
                            this.layout.updateFieldValue(object_id, field, original[field]);
                        }
                    });
                }
                this.$layoutContainer.find('tr.sb-view-layout-list-row').each( async (i: number, tr: any) => {
                    let $tr = $(tr);
                    $tr.trigger('_toggle_mode', 'view');
                    $tr.attr('data-edit', '0');
                });
                $action_set_selected_edit_actions.remove();
                this.$headerContainer.find('#'+'SB_ACTION_ITEM-'+'SB_ACTIONS_BUTTON_INLINE_UPDATE').show();
                this.$headerContainer.find('#'+'SB_ACTION_ITEM-'+'SB_ACTIONS_BUTTON_BULK_ASSIGN').hide();
                /*
                this.selected_ids = [];
                this.layout.setSelection(this.selected_ids);
                */
                return false;
            });
        }

        for(let object_id of selection ) {

            this.$layoutContainer.find('tr[data-id="' + object_id + '"]').each( async (i: number, tr: any) => {
                let $tr = $(tr);
                $tr.addClass('sb-widget');
                // not already in edit mode
                if($tr.attr('data-edit') != '1') {
                    let $td = $tr.children().first();

                    let collection = await this.model.get([object_id]);
                    let object = collection[0];
                    // save original object in the row
                    $tr.data('original', this.deepCopy(object));

                    // mark row as being edited (prevent click handling)
                    $tr.attr('data-edit', '1');
                    // for each widget of the row, switch to edit mode
                    $tr.trigger('_toggle_mode', 'edit');
                }
            });
        }
    }

    // #todo - this should be in LayoutList
    private async actionCreateInline() {

        if(this.is_inline_editing) {
            return;
        }

        this.is_inline_editing = true;

        try {
            // create a new object
            let objectDefaults: any = await this.model.getModelDefaults();
            let response = await ApiService.create(this.entity, objectDefaults);
            let object_id: number = response.id;

            response = await ApiService.read(this.entity, [object_id], this.model.getFieldsProjection(), this.getLang());
            let newObject = response[0];

            // inject object into model
            this.model.add(newObject);

            // adapt actions header width
            const $actionsHeader = this.layout.getContainer().find('thead th[name="actions"]');
            const original_width = $actionsHeader[0].offsetWidth;
            $actionsHeader.css('width', Math.max(original_width, 98) + 'px');

            let actions: any[] = [
                {
                    "id": "save",
                    "icon": "done",
                    "color": "#1a7f4c",
                    "callback": async (object: any) => {
                        console.debug('saving', object);
                        let $tr = this.$layoutContainer.find('tr[data-id="' + object.id + '"]').first();
                        // handle changed objects
                        // let objects = this.model.getChanges([object.id]);
                        // #memo - when creating a new object, we must send the full object
                        let objects = await this.model.get();
                        object = objects.find( (o: any) => o.id == object.id );
                        try {
                            const response = await ApiService.update(this.entity, [object.id], this.model.export(object), false, this.getLang());
                            $tr.trigger('_toggle_mode', 'view');
                            $tr.attr('data-edit', '0');
                            $tr.find('.sb-action-cell').empty();
                            // restore header width
                            $actionsHeader.css('width', original_width + 'px');
                            // toggle is_inline_editing flag
                            this.is_inline_editing = false;
                            // refresh view (necessary for computed operations)
                            await this.onchangeView();
                        }
                        catch(response) {
                            this.displayErrorFeedback(this.translation, response, object, true);
                        }
                    }
                },
                {
                    "id": "cancel",
                    "icon": "cancel",
                    "color": "#ba1a1a",
                    "callback": async (object: any) => {
                        console.debug('cancelled creation', object);
                        this.$layoutContainer.find('tr[data-id="' + object.id + '"]').remove();
                        $tr.remove();
                        this.is_inline_editing = false;
                        $actionsHeader.css('width', original_width + 'px');
                    }
                }
            ];

            // inject object to current layout
            this.layout.prependObject(newObject, actions);

            // switch new object to edit mode
            let $tr = this.$layoutContainer.find('tr[data-id="' + object_id + '"]').first();

            $tr.addClass('sb-widget')
                // save original object in the row
                .data('original', this.deepCopy(newObject))
                // mark row as being edited (prevent click handling)
                .attr('data-edit', '1')
                // for each widget of the row, switch to edit mode
                .trigger('_toggle_mode', 'edit');
        }
        catch(response) {
            this.is_inline_editing = false;
        }
    }


    public async decorateActionDialog($dialog: JQuery, action: any, params: any, object: any = {}, user: any = {}, parent: any = {}) {
        console.debug('View::decorateActionDialog', action, params, object, user, parent);
        let $elem = $('<div />');

        let widgets:any = {};

        // load translation related to controller
        let translation = await ApiService.getTranslation(action.controller.replaceAll('_', '\\'));

        for(let field of Object.keys(params)) {

            let def = params[field];

            let model_fields:any = {};
            model_fields[field] = def;

            let view_fields:any = {};
            view_fields[field] =  {
                "type": "field",
                "value": field,
                "widget": {
                    "header": false
                }
            };

            let config = WidgetFactory.getWidgetConfig(this, field, translation, model_fields, view_fields);
            // #memo - by default the layout is the one of the parent view
            config.layout = 'form';

            let widget: Widget = WidgetFactory.getWidget(this.layout, config.type, config.title, '', config);
            widget.setMode('edit');
            widget.setReadonly(config.readonly);

            if(def.hasOwnProperty('default')) {
                widget.setValue(def.default);
            }

            // if widget has a domain, parse it using current object and user
            if(config.hasOwnProperty('original_domain')) {
                let tmpDomain = new Domain(config.original_domain);
                config.domain = tmpDomain.parse(object, user, parent, this.getEnv()).toArray();
            }
            else {
                config.domain = [];
            }

            console.debug('View::decorateActionDialog: requestiing widget rendering', widget);
            let $node = widget.render();
            $node.css({'margin-bottom': '24px'});
            $elem.append($node);

            widgets[field] = widget;
        }

        $dialog.find('.mdc-dialog__content').append($elem);

        $dialog.on('_accept', () => {
            let result:any = {};
            // build payload to send to target controller
            for(let field of Object.keys(widgets)) {
                let widget = widgets[field];
                let value = widget.getValue();
                if(typeof value == 'object' && value.hasOwnProperty('id')) {
                    value = value.id;
                }
                result[field] = value;
            }
            $dialog.data('result', result);
        });

    }


    /**
     * #memo - we need to provide `Content-Type` in adavance for ApiService.fetch() to apply a conversion to ArrayBuffer.
     * In controllers, use `application/octet-stream` for binary data responses to ensure proper handling and downloading on the client side.
     */
    public async performAction(action:any, params:any, response_descr: any = {}) {
        console.debug('View::performAction');
        try {
            let translation = await ApiService.getTranslation(action.controller.replaceAll('_', '\\'));
            try {

                let content_type: string = 'application/json';

                if(response_descr.hasOwnProperty('content-type')) {
                    content_type = response_descr['content-type'];
                }

                const result = await ApiService.call("/", {do: action.controller, ...params}, content_type);

                const status = ApiService.getLastStatus();
                const headers = ApiService.getLastHeaders();

                // handle binary data response
                if(content_type != 'application/json') {
                    let blob = new Blob([result], {type: content_type});
                    let filename = "file.download";
                    if(headers.hasOwnProperty('content-disposition')) {
                        const parts = headers['content-disposition'].split('=');
                        if(parts.length > 1) {
                            filename = parts[1].slice(1, -1);
                        }
                    }
                    saveAs(blob, filename);
                }

                // handle HTTP 202 (accepted - no change)
                if(status == 202) {
                    console.debug('View::performAction - status `202`: no change');
                    // nothing to perform
                    let $snack = UIHelper.createSnackbar(TranslationService.instant('SB_ACTIONS_NOTIFY_ACTION_SENT', 'Action request sent.'), '', '', 4000);
                    this.$container.append($snack);
                }
                // handle HTTP 205 (reset content)
                else if(status == 205) {
                    console.debug('View::performAction - status `205`: closing context');
                    // mark context as changed to refresh parent lists or views showing deleted object
                    this.setChanged();
                    // close context
                    await this.closeContext();
                }
                // handle other HTTP status (200 - success, 201 - created, 204 - no content)
                else {
                    console.debug('View::performAction - status `other`: refreshing main context');
                    // refresh main view of current context
                    let parentView: View = this.getContext().getView();
                    // #memo - this will trigger updatedContext
                    await parentView.onchangeView();

                    // refresh current view
                    // #memo - this will trigger updatedContext
                    // await this.onchangeView();
                }
            }
            catch(response) {
                await this.updatedContext();
                await this.displayErrorFeedback(translation, response);
            }
        }
        catch(error) {
            console.warn('unexpected error', error);
        }
    }

    /**
     *
     * This method can be invoked by methods from the Layout class.
     *
     * @param translation   Associative array mapping translations sections with their values (@see http://doc.equal.run/usage/i18n/)
     * @param response      HttpResponse holding the error description.
     * @param object        Object involved in the HTTP request that returned with an error status.
     * @param snack         Flag to request a snack showing the error message. BY default, no snack is created.
     *
     * @returns
     */
    public async displayErrorFeedback(translation: any, response: any, object: any = null, snack: boolean = true) {
        console.debug('View::displayErrorFeedback', translation, response, object, snack);
        let delay = 4000;

        if(response && response.hasOwnProperty('errors')) {
            let errors = response['errors'];

            if(errors.hasOwnProperty('INVALID_PARAM')) {
                if(typeof errors['INVALID_PARAM'] == 'object') {
                    let i = 0;
                    // stack snackbars (LIFO: decreasing timeout)
                    for(let field in errors['INVALID_PARAM']) {
                        // for each field, we handle one error at a time (the first one)
                        let error_id: string = <string> String( (Object.keys(errors['INVALID_PARAM'][field]))[0] );
                        let msg: string = '';
                        let value: any = errors['INVALID_PARAM'][field][error_id];

                        if(value) {
                            if(typeof value !== 'object') {
                                msg = value;
                            }
                            else {
                                if(Array.isArray(value)) {
                                    msg = String(value[0] ?? '');
                                }
                                else {
                                    msg = (Object.keys(value))[0];
                                }
                            }
                        }

                        let translated_msg = TranslationService.resolve(translation, 'error', [], field, msg, error_id);
                        if(translated_msg == msg.replace(/_/g, ' ')) {
                            let translated_error = TranslationService.instant('SB_ERROR_' + error_id.toUpperCase());
                            if(translated_error != ('SB_ERROR_' + error_id.toUpperCase())) {
                                translated_msg = translated_error;
                            }
                        }
                        // update widget to provide feedback (as error hint)
                        if(object) {
                            this.layout.markFieldAsInvalid(object['id'], field, translated_msg);
                        }
                        // generate snack, if required
                        if(snack) {
                            setTimeout( () => {
                                let title = TranslationService.resolve(translation, 'model', [], field, field, 'label');
                                let $snack = UIHelper.createSnackbar(title+': '+translated_msg, TranslationService.instant('SB_ERROR_ERROR'), '', delay);
                                this.$container.append($snack);
                            }, delay * i );
                        }
                        ++i;
                    }
                }
                // errors['INVALID_PARAM'] is a string
                else {
                    if(snack) {
                        let error_id:string = <string> String(errors['INVALID_PARAM']);
                        // try to resolve the error message
                        let msg:string = TranslationService.instant('SB_ERROR_INVALID_PARAM');
                        let translated_msg = TranslationService.resolve(translation, 'error', [], 'errors', error_id, error_id);
                        if(translated_msg == error_id.replace(/_/g, ' ')) {
                            let translated_error = TranslationService.instant('SB_ERROR_'+error_id.toUpperCase());
                            if(translated_error != 'SB_ERROR_'+error_id.toUpperCase()) {
                                msg = translated_error;
                            }
                        }
                        else {
                            msg = translated_msg;
                        }
                        let $snack = UIHelper.createSnackbar(msg, TranslationService.instant('SB_ERROR_ERROR'), '', 4000);
                        this.$container.append($snack);
                    }
                }
            }
            else if(errors.hasOwnProperty('MISSING_PARAM')) {
                let msg = TranslationService.instant('SB_ERROR_CONFIG_MISSING_PARAM');
                let $snack = UIHelper.createSnackbar(msg + ' \'' + errors['MISSING_PARAM'] + '\'', TranslationService.instant('SB_ERROR_ERROR'), '', delay);
                this.$container.append($snack);
            }
            else if(errors.hasOwnProperty('NOT_ALLOWED')) {
                if(typeof errors['NOT_ALLOWED'] == 'object') {
                    let i = 0;
                    // stack snackbars (LIFO: decreasing timeout)
                    for(let field in errors['NOT_ALLOWED']) {
                        // errors['NOT_ALLOWED'][field] is a descriptor
                        if(typeof errors['NOT_ALLOWED'][field] == 'object') {
                            // for each field, we handle one error at a time (the first one)
                            let error_id:string = <string> String((Object.keys(errors['NOT_ALLOWED'][field]))[0]);
                            let msg:string = <string>(Object.values(errors['NOT_ALLOWED'][field]))[0];
                            let translated_msg = TranslationService.resolve(translation, 'error', [], field, msg, error_id);
                            if(translated_msg == msg.replace(/_/g, ' ')) {
                                let translated_error = TranslationService.instant('SB_ERROR_'+error_id.toUpperCase());
                                if(translated_error != 'SB_ERROR_'+error_id.toUpperCase()) {
                                    translated_msg = translated_error;
                                }
                            }
                            // update widget to provide feedback (as error hint)
                            if(object) {
                                // #todo - check if field is a known field in the view
                                this.layout.markFieldAsInvalid(object['id'], field, translated_msg);
                            }
                            // generate snack, if required
                            if(snack) {
                                setTimeout( () => {
                                    let title = TranslationService.resolve(translation, 'model', [], field, field, 'label');
                                    let $snack = UIHelper.createSnackbar(title+': '+translated_msg, TranslationService.instant('SB_ERROR_ERROR'), '', delay);
                                    this.$container.append($snack);
                                }, delay * i );
                            }
                        }
                        // errors['NOT_ALLOWED'][field] is a string
                        else {
                            if(snack) {
                                let error_id:string = <string> String(errors['NOT_ALLOWED'][field]);
                                // try to resolve the error message
                                let msg:string = TranslationService.instant('SB_ERROR_NOT_ALLOWED');
                                let translated_msg = TranslationService.resolve(translation, 'error', [], 'errors', error_id, error_id);
                                if(translated_msg == error_id.replace(/_/g, ' ')) {
                                    let translated_error = TranslationService.instant('SB_ERROR_'+error_id.toUpperCase());
                                    if(translated_error != 'SB_ERROR_'+error_id.toUpperCase()) {
                                        msg = translated_error;
                                    }
                                }
                                else {
                                    msg = translated_msg;
                                }
                                setTimeout( () => {
                                    let title = TranslationService.resolve(translation, 'model', [], field, field, 'label');
                                    let $snack = UIHelper.createSnackbar(title+': '+translated_msg, TranslationService.instant('SB_ERROR_ERROR'), '', delay);
                                    this.$container.append($snack);
                                }, delay * i );
                            }
                        }
                        ++i;
                    }
                }
                // errors['NOT_ALLOWED'] is a string
                else {
                    let error_id: string = <string> String(errors['NOT_ALLOWED']);
                    if(error_id == 'insufficient_auth_level') {
                        // open escalation popop
                        this.openAuthPopup("/auth/#/level/2", "Escalation Auth");
                    }
                    if(snack) {
                        let msg = TranslationService.instant('SB_ERROR_NOT_ALLOWED');
                        // try to resolve the error message
                        let translated_msg = TranslationService.resolve(translation, 'error', [], 'errors', error_id, error_id);
                        if(translated_msg == error_id.replace(/_/g, ' ')) {
                            let translated_error = TranslationService.instant('SB_ERROR_'+error_id.toUpperCase());
                            if(translated_error != 'SB_ERROR_'+error_id.toUpperCase()) {
                                msg = translated_error;
                            }
                        }
                        else {
                            msg = translated_msg;
                        }
                        let $snack = UIHelper.createSnackbar(msg, TranslationService.instant('SB_ERROR_ERROR'), '', delay);
                        this.$container.append($snack);
                    }
                }
            }
            else if(errors.hasOwnProperty('CONFLICT_OBJECT')) {
                // one or more fields violate a unique constraint
                if(typeof errors['CONFLICT_OBJECT'] == 'object') {

                    let i = 0;
                    for(let field in errors['CONFLICT_OBJECT']) {
                        let msg = TranslationService.instant('SB_ERROR_DUPLICATE_VALUE');
                        if(object) {
                            this.layout.markFieldAsInvalid(object['id'], field, msg);
                        }
                        if(snack) {
                            setTimeout( () => {
                                let title = TranslationService.resolve(translation, 'model', [], field, field, 'label');
                                let $snack = UIHelper.createSnackbar(title+': '+msg, TranslationService.instant('SB_ERROR_ERROR'), '', delay);
                                this.$container.append($snack);
                            }, delay * i);
                        }
                        ++i;
                    }
                }
                else if(errors['CONFLICT_OBJECT'] == 'concurrent_change') {
                    // object has been modified in the meanwhile
                    try {
                        await new Promise( (resolve, reject) => {
                            let confirmed = confirm(TranslationService.instant('SB_ACTIONS_MESSAGE_ERASE_CONCURRENT_CHANGES'));
                            return confirmed ? resolve(true) : reject(false);
                        });
                        // #toto - this does not cover case where an action uses a custom controller
                        // (saving should not occur here)
                        const response = await ApiService.update(this.entity, [object['id']], this.model.export(object), true, this.getLang());
                        // this.closeContext();
                        return response;
                    }
                    catch(response) {
                        throw response;
                    }

                }
                // errors['CONFLICT_OBJECT'] is a string
                else {
                    if(snack) {
                        let title = TranslationService.instant('SB_ERROR_CONFLICT_OBJECT');
                        // try to resolve the error message
                        let msg = TranslationService.resolve(translation, 'error', [], 'errors', errors['CONFLICT_OBJECT'], errors['CONFLICT_OBJECT']);
                        let $snack = UIHelper.createSnackbar(title+' '+msg, TranslationService.instant('SB_ERROR_ERROR'), '', 4000);
                        this.$container.append($snack);
                    }
                }
            }
            else if(errors.hasOwnProperty('SQL_ERROR')) {
                if(snack) {
                    let title = TranslationService.instant('SB_ERROR_SQL_ERROR');
                    // try to resolve the error message
                    let msg = TranslationService.resolve(translation, 'error', [], 'errors', errors['SQL_ERROR'], errors['SQL_ERROR']);
                    let $snack = UIHelper.createSnackbar(title+' '+msg, TranslationService.instant('SB_ERROR_ERROR'), '', 4000);
                    this.$container.append($snack);
                }
            }
            else if(errors.hasOwnProperty('UNKNOWN_OBJECT')) {
                if(snack) {
                    let title = TranslationService.instant('SB_ERROR_UNKNOWN_OBJECT');
                    // try to resolve the error message
                    let msg = TranslationService.resolve(translation, 'error', [], 'errors', errors['UNKNOWN_OBJECT'], errors['UNKNOWN_OBJECT']);
                    let $snack = UIHelper.createSnackbar(title+' '+msg, TranslationService.instant('SB_ERROR_ERROR'), '', 4000);
                    this.$container.append($snack);
                }
            }
            else if(errors.hasOwnProperty('UNKNOWN_ERROR')) {
                if(snack) {
                    let title = TranslationService.instant('SB_ERROR_UNKNOWN');
                    let msg = TranslationService.resolve(translation, 'error', [], 'errors', errors['UNKNOWN_ERROR'], errors['UNKNOWN_ERROR']);
                    let $snack = UIHelper.createSnackbar(title+' '+msg, TranslationService.instant('SB_ERROR_ERROR'), '', 4000);
                    this.$container.append($snack);
                }
            }
            else if(errors.hasOwnProperty('INVALID_CONFIG')) {
                if(snack) {
                    let title = TranslationService.instant('SB_ERROR_CONFIG_MISSING_PARAM');
                    let msg = TranslationService.resolve(translation, 'error', [], 'errors', errors['INVALID_CONFIG'], errors['INVALID_CONFIG']);
                    let $snack = UIHelper.createSnackbar(title+' '+msg, TranslationService.instant('SB_ERROR_ERROR'), '', 4000);
                    this.$container.append($snack);
                }
            }
        }
        return false;
    }

    /**
     * Tells if an action button is visible, based on configuration from the View Header.
     * Action descriptor can either be a boolean, an object, or an array.
     * @see https://doc.equal.run/usage/views/lists/#actions
     * #isVisible #isActionVisible
     */
    private isActionEnabled(action: any, mode: string): boolean {
        // #todo - these are actions in header - find a way to inject current object for form views
        console.debug("View::isActionEnabled - evaluating action", action, mode);
        // direct boolean (visibility)
        if(typeof action === 'boolean') {
            return action;
        }
        // array of descriptors
        if(Array.isArray(action)) {
            if(action.length <= 0) {
                return false;
            }
            action = action[0];
        }
        // single descriptor
        if(typeof action === 'object') {
            if(action.hasOwnProperty(mode)) {
                // boolean
                if(typeof action[mode] === 'boolean') {
                    return action[mode];
                }
                // visibility domain
                else if(Array.isArray(action[mode])) {
                    let domain = new Domain(action[mode]);
                    return domain.parse({}, this.getUser(), {}, this.getEnv()).test();
                }
                // other value for 'view' (e.g. view id)
                else {
                    return true;
                }
            }
            else if(action.hasOwnProperty('visible')) {
                // #todo - add support for visible.{mode}
                if(typeof action.visible === 'boolean') {
                    return action.visible;
                }
                else if(Array.isArray(action.visible)) {
                    // visibility domain
                    let domain = new Domain(action.visible);
                    return domain.parse({}, this.getUser(), {}, this.getEnv()).test();
                }
            }
            else {
                return true;
            }
        }
        return false;
    }

    private openAuthPopup(url: string, title = "Authentication", width = 400, height = 600) {
        // Calculer la position pour centrer la popup
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;
        const left = (screenWidth - width) / 2;
        const top = (screenHeight - height) / 2;

        // Options pour la fenêtre
        const options = `
            width=${width},
            height=${height},
            top=${top},
            left=${left},
            resizable=yes,
            scrollbars=yes,
            status=no,
            menubar=no,
            toolbar=no
        `;

        const popup = window.open(url, title, options);

        if(!popup || popup.closed || typeof popup.closed == 'undefined') {
            alert("Please allow popups for this App.");
        }

        return popup;
    }

    private async translateFilterClause(clause: Clause) {
        let result = '';

        console.debug('View::translateFilterClause', clause)
        for(let conditionObj of clause.getConditions()) {
            let condition = conditionObj.toArray();
            if(condition.length == 3) {
                let translation = this.getTranslation();
                let model_fields = this.getModelFields();

                let operand = condition[0];
                let operator = condition[1];
                let value = condition[2];

                let field = operand;

                // assign default resulting values
                let res_operand = operand;
                let res_operator = operator;
                let res_value = value;

                /*
                    Translate field
                */
                res_operand = TranslationService.resolve(translation, 'model', [], field, field, 'label');

                /*
                    Translate operator
                */
                switch(operator) {
                    case 'like':
                        res_value = res_value.replace(/%/g, '');
                    case 'in':
                    case 'is':
                    case '=':
                        res_operator = '=';
                        break;
                    case 'not in':
                    case '<>':
                    case '!=':
                        res_operator = '<>';
                        break;
                }

                /*
                    Translate value
                */
                if(model_fields.hasOwnProperty(field)) {
                    // get field type
                    let type: string | null = this.model.getFinalType(field);

                    // handle translation by type

                    if(type === 'string' && model_fields[field].selection) {
                        let translated = TranslationService.resolve(translation, 'model', [], field, model_fields[field].selection, 'selection');
                        // assign translation map
                        let values = translated;
                        // normalize translation map
                        if(Array.isArray(translated)) {
                            // convert array to a Map (original values as keys and translations as values)
                            values = {};
                            for(let i = 0, n = model_fields[field].selection.length; i < n; ++i) {
                                values[model_fields[field].selection[i]] = translated[i];
                            }
                        }
                        if(values.hasOwnProperty(value)) {
                            res_value = values[value];
                        }
                    }
                    else if(type && ['date', 'datetime'].indexOf(type) >= 0) {
                        if(value instanceof Date) {
                            res_value = value.toISOString();
                        }
                        res_value = res_value.substring(0, 10);
                    }
                    else if(type == 'many2one') {
                        if(model_fields[field].hasOwnProperty('foreign_object')) {
                            let entity = model_fields[field].foreign_object;
                            // value should be an ID
                            // read name field of targeted entity
                            try {
                                const response = await ApiService.read(entity, [value], ['name'], this.getLang());
                                let object = response[0];
                                res_value = object['name'];
                            }
                            catch(response) {
                                // ignore errors
                            }
                        }
                    }

                }

                if(result.length) {
                    result = result + ' & ';
                }
                result = res_operand + ' ' + res_operator + ' ' + res_value;
            }
        }

        return result;
    }

    private extractFieldsFromDomain(domain_array: any): string[] {
        const result: Set<string> = new Set();

        if (!Array.isArray(domain_array) || domain_array.length === 0) {
            return [];
        }

        let domain: Domain = new Domain(domain_array);

        for(let clause of domain.getClauses()) {
            for(let condition of clause.getConditions()) {
                 // 1) operand
                let operand: any = condition.getOperand();
                if(typeof operand === "string") {
                    // ignore references to context
                    if(operand.startsWith("user.") || operand.startsWith('env.') || operand.startsWith('parent.')) {
                        continue;
                    }
                    // relative ORM field
                    if(operand.startsWith('object.')) {
                        const path: string = operand.substring('object.'.length);
                        if(path.length > 0) {
                            result.add(path);
                        }
                        continue;
                    }
                    // direct ORM field
                    else {
                        result.add(operand);
                    }

                }
                // 2) value
                let value: any = condition.getValue();
                if(typeof value === "string") {
                    // ignore references to context
                    if(value.startsWith("user.") || value.startsWith('env.') || value.startsWith('parent.')) {
                        continue;
                    }
                    // relative ORM field
                    if(value.startsWith("object.")) {
                        const path: string = value.substring('object.'.length);
                        if(path.length > 0) {
                            result.add(path);
                        }
                        continue;
                    }
                }
            }
        }

        return Array.from(result);
    }

}

export default View;