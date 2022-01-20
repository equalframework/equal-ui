import { $, jqlocale } from "./jquery-lib";
import { UIHelper } from './material-lib';
import { environment } from "./environment";

import { ApiService, TranslationService } from "./equal-services";

import { Context, Layout, Model, Domain } from "./equal-lib";



export class View {

    private context: Context;

    public entity: string;
    public type: string;
    public name: string;

    // Mode under which the view is to be displayed ('View' [default], or 'edit')
    public mode;
    // Purpose for which the view is to be displayed (this impacts the action buttons in the header)
    public purpose;

    // View holds the params for search requests performed by Model
    public domain: any[];
    private order: string;
    private sort: string;
    private start: number;
    private limit: number;
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

    // custom actions of the view
    private custom_actions: any;

    // config object for setting display of list controls and action buttons
    private config: any;

    // List of currently selected filters from View definition (for filterable types)
    private applied_filters_ids: any[];

    // When type is list, one or more objects might be selected
    private selected_ids: any[];

    private is_ready_promise: any;

    public $container: any;

    public $headerContainer: any;
    public $layoutContainer: any;
    public $footerContainer: any;



    /**
     *
     * @param entity    entity (package\Class) to be loaded: should be set only once (depend on the related view)
     * @param type      type of the view ('list', 'form', ...)
     * @param name      name of the view (eg. 'default')
     * @param domain
     * @param mode
     * @param purpose
     * @param lang
     * @param config    extra parameters related to contexts communications
     */
    constructor(context: Context, entity: string, type: string, name: string, domain: any[], mode: string, purpose: string, lang: string, config: any = null) {
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
            show_actions: true,
            show_filter: true,
            show_pagination: true,
            // list of actions available for applying to a selection (relational fields widgets define their own actions)
            selection_actions: [
                {
                    title: 'SB_ACTIONS_BUTTON_INLINE_UPDATE',
                    icon:  'edit_attributes',
                    primary: false,
                    handler: (selection:any) => this.actionListInlineEdit(selection)
                },
                {
                    title: 'SB_ACTIONS_BUTTON_BULK_ASSIGN',
                    icon:  'dynamic_form',
                    primary: false,
                    visible: false,
                    handler: (selection:any) => this.actionBulkAssign(selection)
                },
                {
                    id: "action.update",
                    title: 'SB_ACTIONS_BUTTON_UPDATE',
                    icon:  'edit',
                    primary: true,
                    handler: (selection:any) => {
                        let selected_id = selection[0];
                        this.openContext({entity: this.entity, type: 'form', name: this.name, domain: ['id', '=', selected_id], mode: 'edit', purpose: 'update'});
                    }
                },
                {
                    title: 'SB_ACTIONS_BUTTON_CLONE',
                    icon:  'content_copy',
                    primary: false,
                    handler: async (selection:any) => {
                        try {
                            await ApiService.clone(this.entity, selection);
                            // refresh the model
                            await this.onchangeView();
                        }
                        catch(response) {
                            console.log('unexpected error', response);
                            try {
                                await this.displayErrorFeedback(response);
                            }
                            catch(error) {
                            }
                        }
                    }
                },
                {
                    title: 'SB_ACTIONS_BUTTON_ARCHIVE',
                    icon:  'archive',
                    primary: false,
                    handler: async (selection:any) => {
                        // display confirmation dialog with checkbox for archive
                        let $dialog = UIHelper.createDialog('confirm_archive_dialog', TranslationService.instant('SB_ACTIONS_ARCHIVE_CONFIRM'), TranslationService.instant('SB_DIALOG_ACCEPT'), TranslationService.instant('SB_DIALOG_CANCEL'));
                        $dialog.appendTo(this.$container);
                        // inject component as dialog content
                        this.decorateDialogArchiveConfirm($dialog);

                        $dialog.trigger('_open')
                        .on('_ok', async (event, result) => {
                            try {
                                await ApiService.archive(this.entity, selection);
                                // refresh the model
                                await this.onchangeView();
                                }
                            catch(response) {
                                try {
                                    await this.displayErrorFeedback(response);
                                }
                                catch(error) {

                                }
                            }
                        });
                    }
                },
                {
                    title: 'SB_ACTIONS_BUTTON_DELETE',
                    icon:  'delete',
                    primary: true,
                    handler: async (selection:any) => {
                        // display confirmation dialog with checkbox for permanent deletion
                        let $dialog = UIHelper.createDialog('confirm_deletion_dialog', TranslationService.instant('SB_ACTIONS_DELETION_CONFIRM'), TranslationService.instant('SB_DIALOG_ACCEPT'), TranslationService.instant('SB_DIALOG_CANCEL'));
                        $dialog.appendTo(this.$container);
                        // inject component as dialog content
                        this.decorateDialogDeletionConfirm($dialog);

                        $dialog.trigger('_open')
                        .on('_ok', async (event, result) => {
                            if(result.confirm) {
                                try {
                                    await ApiService.delete(this.entity, selection, false);
                                    // refresh the model
                                    await this.onchangeView();
                                }
                                catch(response) {
                                    try {
                                        await this.displayErrorFeedback(response);
                                    }
                                    catch(error) {

                                    }
                                }
                            }
                        });
                    }
                }
            ]
            // selected_sections: {1: 2}
        };

        // override config options, if other are given
        if(config) {
            this.config = {...this.config, ...config};
        }

        this.order = (this.config.hasOwnProperty('order'))?this.config.order:'id';
        this.sort = (this.config.hasOwnProperty('sort'))?this.config.sort:'asc';
        this.start = 0;
        this.limit = 25;

        this.selected_ids = [];

        this.applied_filters_ids = [];

        this.filters = {};
        this.custom_actions = {};

        this.exports = {
            "export.pdf": {
                "id": "export.pdf",
                "label": TranslationService.instant('SB_EXPORTS_AS_PDF'),
                "icon": "print",
                "description": "Export as PDF",
                "controller": "model_export-pdf",
                "view": this.getId(),
                "domain": JSON.stringify(this.getDomain())
            },
            "export.xls": {
                "id": "export.xls",
                "label": TranslationService.instant('SB_EXPORTS_AS_XLS'),
                "icon": "print",
                "description": "Export as XLS",
                "controller": "model_export-xls",
                "view": this.getId()
            }
        };


        this.$container = $('<div />').addClass('sb-view').hide();

        this.$headerContainer = $('<div />').addClass('sb-view-header').appendTo(this.$container);
        this.$layoutContainer = $('<div />').addClass('sb-view-layout').appendTo(this.$container);
        this.$footerContainer = $('<div />').addClass('sb-view-footer').appendTo(this.$container);


        this.layout = new Layout(this);
        this.model = new Model(this);

        this.init();
    }

    private async init() {
        console.log('View::init');
        try {

            this.translation = await ApiService.getTranslation(this.entity, this.getLocale());
            try {
                this.view_schema = await ApiService.getView(this.entity, this.type + '.' + this.name);
            }
            catch(response) {
                // fallback to default view
                this.view_schema = await ApiService.getView(this.entity, this.type + '.default');
            }
            this.model_schema = await ApiService.getSchema(this.entity);
            this.loadViewFields(this.view_schema);
            this.loadModelFields(this.model_schema);

            if(this.view_schema.hasOwnProperty("order")) {
                this.order = this.view_schema.order;
            }

            if(this.view_schema.hasOwnProperty("sort")) {
                this.sort = this.view_schema.sort;
            }

            if(this.view_schema.hasOwnProperty("filters")) {
                for(let item of this.view_schema.filters) {
                    this.filters[item.id] = item;
                }
            }

            if(this.view_schema.hasOwnProperty("exports")) {
                for(let item of this.view_schema.exports) {
                    this.exports[item.id] = item;
                }
            }

            if(this.view_schema.hasOwnProperty("actions")) {
                for(let item of this.view_schema.actions) {
                    this.custom_actions[item.id] = item;
                }
            }

            // if view schema specifies a domain, merge it with domain given in constructor
            if(this.view_schema.hasOwnProperty("domain")) {
                // domain attribute is either a string or an array
                let domain = eval(this.view_schema.domain);
                // merge domains
                let tmpDomain = new Domain(this.domain);
                tmpDomain.merge(new Domain(domain));
                this.domain = tmpDomain.toArray();
            }

            if(['list', 'cards'].indexOf(this.type) >= 0) {
                this.$layoutContainer.addClass('sb-view-layout-list');
                this.layoutListHeader();
                this.layoutListFooter();
            }
            if(['form'].indexOf(this.type) >= 0) {
                this.$layoutContainer.addClass('sb-view-layout-form');
                this.layoutFormHeader();
            }

            await this.layout.init();
            await this.model.init();

        }
        catch(err) {
            console.log('Unable to init view ('+this.entity+'.'+this.getId()+')', err);
        }

        this.is_ready_promise.resolve();

        this.$container.show();
        console.log('View::init - end');
    }


    private deepCopy(obj:any):any {
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

    public isReady() {
        return this.is_ready_promise;
    }

    public getContext() {
        return this.context;
    }

    public getUser() {
        return this.context.getUser();
    }

    public getId() {
        return this.type + '.' + this.name;
    }

    /**
     * Relay Context opening requests to parent Context.
     *
     * @param config
     */
    public async openContext(config: any) {
        await this.context.openContext(config);
    }

    public closeContext(data: any = {}) {
        this.context.closeContext(data);
    }

    public getConfig() {
        return this.config;
    }

    public setMode(mode: string) {
        this.mode = mode;
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
        this.start = start;;
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

    /**
     * Applicable domain for the View corresponds to initial domain (from parent Context) with additional filters currently applied on the View
     */
    public getDomain() {
        console.log('View::getDomain', this.domain, this.applied_filters_ids);

        let domain = new Domain(this.domain);

        let filters_domain = [];
        for(let filter_id of this.applied_filters_ids) {
            filters_domain.push(this.filters[filter_id].clause);
        }

        domain.merge(new Domain(filters_domain));

        return domain.parse({}, this.getUser()).toArray();
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
    public getLang() {
        return this.lang;
    }
    public getLocale() {
        // #todo - allow swithing amongst available langs
        return environment.locale;
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
     * Returns a Map of layout fields items mapping names with their definition
     */
    public getViewFields() {
        return this.view_fields;
    }

    /**
     * Returns a Map of model fields items mapping names with their definition
     */
    public getModelFields() {
        return this.model_fields;
    }


    /**
     * Generates a map holding all fields (as items objects) that are present in a given view
     * and stores them in the `view_fields` map (does not maintain the field order)
     */
	private loadViewFields(view_schema: any) {
        console.log('View::loadFields', view_schema);
        this.view_fields = {};
        var stack = [];
        // view is valid
        if(view_schema.hasOwnProperty('layout')) {
            stack.push(view_schema['layout']);
            var path = ['groups', 'sections', 'rows', 'columns'];

            while(stack.length) {
                var elem = stack.pop();

                if(elem.hasOwnProperty('items')) {
                    for (let item of elem['items']) {
                        if(item.type == 'field' && item.hasOwnProperty('value')){
                            this.view_fields[item.value] = item;
                        }
                    }
                }
                else {
                    for (let step of path) {
                        if(elem.hasOwnProperty(step)) {
                            for (let obj of elem[step]) {
                                stack.push(obj);
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Generates a map holding all fields in the current model schema
     * and stores it in the `model_fields` member
     */
	private loadModelFields(model_schema: any) {
        console.log('View::loadVModelFields', model_schema);
        this.model_fields = model_schema.fields;
    }


    private layoutListFooter() {
        // it is best UX practice to avoid footer on lists
    }

    private layoutListHeader() {
        console.log('View::layoutListHeader');

        // apend header structure
        this.$headerContainer.append(' \
            <div class="sb-view-header-list"> \
                <div class="sb-view-header-list-actions"> \
                    <div class="sb-view-header-list-actions-set"></div> \
                </div> \
                <div class="sb-view-header-list-navigation"></div> \
            </div>'
        );

        let $elem = this.$headerContainer.find('.sb-view-header-list');

        let $level1 = $elem.find('.sb-view-header-list-actions');
        let $level2 = $elem.find('.sb-view-header-list-navigation');

        let $actions_set = $level1.find('.sb-view-header-list-actions-set');

        if(this.config.show_actions) {
            switch(this.purpose) {
                case 'view':
                    $actions_set
                    .prepend(
                        UIHelper.createButton('action-edit', TranslationService.instant('SB_ACTIONS_BUTTON_CREATE'), 'raised')
                        .on('click', async () => {
                            try {
                                let view_type = 'form';
                                let view_name = this.name;
                                if(this.custom_actions.hasOwnProperty('ACTIONS.CREATE')) {
                                    let parts = this.custom_actions['ACTIONS.CREATE'].view.split('.');
                                    if(parts.length) view_type = <string>parts.shift();
                                    if(parts.length) view_name = <string>parts.shift();

                                }
                                // request a new Context for editing a new object
                                await this.openContext({entity: this.entity, type: view_type, name: view_name, domain: this.domain, mode: 'edit', purpose: 'create'});
                            }
                            catch(response) {
                                try {
                                    await this.displayErrorFeedback(response);
                                }
                                catch(error) {

                                }
                            }
                        })
                    );
                    break;
                case 'select':
                    $actions_set
                    .prepend(
                        UIHelper.createButton('action-create', TranslationService.instant('SB_ACTIONS_BUTTON_CREATE'), 'text')
                        .on('click', async () => {
                            try {
                                // request a new Context for editing a new object
                                await this.openContext({entity: this.entity, type: 'form', name: this.name, domain: this.domain, mode: 'edit', purpose: 'create'});
                            }
                            catch(response) {
                                try {
                                    await this.displayErrorFeedback(response);
                                }
                                catch(error) {

                                }
                            }
                        })
                    )
                    .prepend(
                        UIHelper.createButton('action-select', TranslationService.instant('SB_ACTIONS_BUTTON_SELECT'), 'raised', 'check')
                        .on('click', async () => {
                            // close context and relay selection, if any (mark the view as changed to force parent context update)
// #todo : user should not be able to select more thant one id
                            let objects = await this.model.get(this.selected_ids);
                            this.closeContext({selection: this.selected_ids, objects: objects});
                        })
                    );
                    break;
                case 'add':
                    $actions_set
                    .prepend(
                        UIHelper.createButton('action-create', TranslationService.instant('SB_ACTIONS_BUTTON_CREATE'), 'text')
                        .on('click', async () => {
                            try {
                                // request a new Context for editing a new object
                                await this.openContext({entity: this.entity, type: 'form', name: this.name, domain: this.domain, mode: 'edit', purpose: 'create'});
                            }
                            catch(response) {
                                try {
                                    await this.displayErrorFeedback(response);
                                }
                                catch(error) {

                                }
                            }
                        })
                    )
                    .prepend(
                        UIHelper.createButton('action-add', TranslationService.instant('SB_ACTIONS_BUTTON_ADD'), 'raised', 'check')
                        .on('click', async () => {
                            // close context and relay selection, if any (mark the view as changed to force parent context update)
                            let objects = await this.model.get(this.selected_ids);
                            this.closeContext({selection: this.selected_ids, objects: objects});
                        })
                    );
                    break;
                case 'widget':
                default:
                    break;
            }
        }

        //  bulk assign action
        let $bulk_assign_dialog = UIHelper.createDialog('bulk_assign_dialog', TranslationService.instant('SB_ACTIONS_BUTTON_BULK_ASSIGN'), TranslationService.instant('SB_DIALOG_ACCEPT'), TranslationService.instant('SB_DIALOG_CANCEL'));
        $bulk_assign_dialog.appendTo(this.$container);
        // inject component as dialog content
        this.decorateBulkAssignDialog($bulk_assign_dialog);


        // container for holding chips of currently applied filters
        let $filters_set = $('<div />').addClass('sb-view-header-list-filters-set mdc-chip-set').attr('role', 'grid');

        // for creating a quick filter based on name
        let $filters_search = $('<div />').addClass('sb-view-header-list-filters-search');
        let $search_input = UIHelper.createInput('sb-view-header-search', TranslationService.instant('SB_FILTERS_SEARCH'), '', '', '', false, 'outlined', 'close').appendTo($filters_search);

        $search_input.find('.mdc-text-field__icon').on('click', async (e) => {
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
                let value = <string> $search_input.find('input').val();
                if(value.length) {
                    let filter = {
                        "id": "filter_search_on_name",
                        "label": "search",
                        "description": TranslationService.instant('SB_FILTERS_SEARCH_ON_NAME'),
                        "clause": ['name', 'ilike', '%'+value+'%']
                    };
                    // add filter to available filters
                    this.filters[filter.id] = filter;
                    this.applyFilter(filter.id);
                }
            }, 100);
        });

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
        if(this.filters.length) {
            UIHelper.createListDivider().appendTo($filters_list);
        }

        let $custom_filter_dialog = UIHelper.createDialog('custom_filter_dialog', TranslationService.instant('SB_FILTERS_ADD_CUSTOM_FILTER'), TranslationService.instant('SB_DIALOG_ACCEPT'), TranslationService.instant('SB_DIALOG_CANCEL'));
        $custom_filter_dialog.appendTo(this.$container);
        // inject component as dialog content
        this.decorateCustomFilterDialog($custom_filter_dialog);

        UIHelper.createListItem('SB_FILTERS_ADD_CUSTOM_FILTER', TranslationService.instant('SB_FILTERS_ADD_CUSTOM_FILTER'))
        .appendTo($filters_list)
        .on('click', (event) => $custom_filter_dialog.trigger('_open') );


        UIHelper.decorateMenu($filters_menu);
        $filters_button.find('button').on('click', () => $filters_menu.trigger('_toggle') );






        // fields toggle menu : button for displaying the fields menu
        let $fields_toggle_button =
        $('<div/>').addClass('sb-view-header-list-fields_toggle mdc-menu-surface--anchor')
        .append( UIHelper.createButton('view-filters', 'fields', 'icon', 'more_vert') );

        // create floating menu for fields selection
        let $fields_toggle_menu = UIHelper.createMenu('fields-menu').addClass('sb-view-header-list-fields_toggle-menu').appendTo($fields_toggle_button);
        let $fields_toggle_list = UIHelper.createList('fields-list').appendTo($fields_toggle_menu);

// #todo : translate fields names
        for(let item of this.getViewSchema().layout.items ) {
            let label = (item.hasOwnProperty('label'))?item.label:item.value.charAt(0).toUpperCase() + item.value.slice(1);
            let visible = (item.hasOwnProperty('visible'))?item.visible:true;

            UIHelper.createListItemCheckbox('sb-fields-toggle-checkbox-'+item.value, label)
            .appendTo($fields_toggle_list)
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

        UIHelper.decorateMenu($fields_toggle_menu);
        $fields_toggle_button.find('button').on('click', () => $fields_toggle_menu.trigger('_toggle') );


        // pagination controls
        let $pagination = UIHelper.createPagination().addClass('sb-view-header-list-pagination');

        let $refresh_list_button = UIHelper.createButton('refresh-view', 'refresh', 'icon', 'refresh').on('click', () => this.onchangeView());

        $pagination.find('.pagination-container')
        .prepend( $refresh_list_button );

        $pagination.find('.pagination-total')
        .append( $('<span class="sb-view-header-list-pagination-start"></span>') ).append( $('<span />').text('-') )
        .append( $('<span class="sb-view-header-list-pagination-end"></span>') ).append( $('<span />').text(' / ') )
        .append( $('<span class="sb-view-header-list-pagination-total"></span>') );

        $pagination.find('.pagination-navigation')
        .append(
            UIHelper.createButton('', '', 'icon', 'first_page').addClass('sb-view-header-list-pagination-first_page')
            .on('click', (event: any) => {
                this.setStart(0);
                this.onchangeView();
            })
        )
        .append(
            UIHelper.createButton('', '', 'icon', 'chevron_left').addClass('sb-view-header-list-pagination-prev_page')
            .on('click', (event: any) => {
                this.setStart( Math.max(0, this.getStart() - this.getLimit()) );
                this.onchangeView();
            })
        )
        .append(
            UIHelper.createButton('', '', 'icon', 'chevron_right').addClass('sb-view-header-list-pagination-next_page')
            .on('click', (event: any) => {
                let new_start:number = Math.min( this.getTotal()-1, this.getStart() + this.getLimit() );
                console.log('new start', new_start, this.getStart(), this.getLimit());
                this.setStart(new_start);
                this.onchangeView();
            })
        )
        .append(
            UIHelper.createButton('', '', 'icon', 'last_page').addClass('sb-view-header-list-pagination-last_page')
            .on('click', (event: any) => {
                let new_start:number = this.getTotal()-1;
                this.setStart(new_start);
                this.onchangeView();
            })
        );

        let $select = UIHelper.createPaginationSelect('', '', [5, 10, 25, 50, 100], 25).addClass('sb-view-header-list-pagination-limit_select');

        $pagination.find('.pagination-rows-per-page')
        .append($select);

        $select.find('input').on('change', (event: any) => {
            let $this = $(event.currentTarget);
            this.setLimit(<number>$this.val());
            this.setStart(0);
            this.onchangeView();
        });

        // attach elements to header toolbar
        $level2.append( $filters_button );
        $level2.append( $filters_search );
        $level2.append( $filters_set );
        $level2.append( $pagination );
        $level2.append( $fields_toggle_button );

        this.$headerContainer.append( $elem );
    }
    /**
     * Re-draw the list layout.
     * This method is triggered by a model change @see layoutRefresh() or a selection change @see onChangeSelection().
     *
     * @param full
     */
    private layoutListRefresh(full: boolean = false) {
        console.log('View::layoutListRefresh');
        // update footer indicators (total count)
        let limit: number = this.getLimit();
        let total: number = this.getTotal();
        let start: number = (total)?this.getStart() + 1:0;
        let end: number = start + limit - 1;
        end = (total)?Math.min(end, start + this.model.ids().length - 1):0;

        this.$headerContainer.find('.sb-view-header-list-pagination-total').html(total);
        this.$headerContainer.find('.sb-view-header-list-pagination-start').html(start);
        this.$headerContainer.find('.sb-view-header-list-pagination-end').html(end);

        this.$headerContainer.find('.sb-view-header-list-pagination-first_page').prop('disabled', !(start > limit));
        this.$headerContainer.find('.sb-view-header-list-pagination-prev_page').prop('disabled', !(start > limit));
        this.$headerContainer.find('.sb-view-header-list-pagination-next_page').prop('disabled', !(start <= total-limit));
        this.$headerContainer.find('.sb-view-header-list-pagination-last_page').prop('disabled', !(start <= total-limit));


        let $action_set = this.$headerContainer.find('.sb-view-header-list-actions-set');

        // abort any pending edition
        let $actions_selected_edit = $action_set.find('.sb-view-header-list-actions-selected-edit');
        if($actions_selected_edit.length) {
            $actions_selected_edit.find('.action-selected-edit-cancel').trigger('click');
        }
        // remove containers related to selection actions
        $action_set.find('.sb-view-header-list-actions-selected-edit').remove();
        $action_set.find('.sb-view-header-list-actions-selected').remove();
        $action_set.find('.sb-view-header-list-actions-export').remove();

        // do not show the actions menu for 'add' and 'select' purposes
        if(['view', 'widget'].indexOf(this.purpose) > -1) {
            if(this.purpose == 'view') {
                // create export menu (always visible: no selection means "export all")
                let $export_actions_menu_button = $('<div/>').addClass('sb-view-header-list-actions-export mdc-menu-surface--anchor')
                .append(UIHelper.createButton('selection-action-'+'SB_ACTIONS_BUTTON_EXPORT', 'export', 'icon', 'file_download'))
                .appendTo($action_set);

                let $export_actions_menu = UIHelper.createMenu('export-actions-menu').addClass('sb-view-header-list-export-menu').appendTo($export_actions_menu_button);
                let $export_actions_list = UIHelper.createList('export-actions-list').appendTo($export_actions_menu);

                // generate filters list
                for(let export_id in this.exports) {
                    let item = this.exports[export_id];
                    let object_id = (this.selected_ids.length)?this.selected_ids[0]:0;

                    let view = item.hasOwnProperty('view')?'&view_id='+item.view:'';

                    let selection = JSON.stringify(this.selected_ids);
                    let domain = JSON.stringify(this.getDomain());
                    let export_title = TranslationService.resolve(this.translation, 'view', [this.getId(), 'exports'], item.id, item.label, 'label')
                    UIHelper.createListItem('SB_ACTIONS_BUTTON_EXPORT-'+item.id, export_title, item.hasOwnProperty('icon')?item.icon:'')
                    .on( 'click', (event:any) => {
                        window.open(environment.backend_url+'/?get='+item.controller+'&entity='+this.entity+'&domain='+domain+'&id='+object_id+view+'&ids='+selection+'&lang='+this.lang, "_blank");
                    })
                    .appendTo($export_actions_list);

                }

                UIHelper.decorateMenu($export_actions_menu);
                $export_actions_menu_button.find('button').on('click', () => $export_actions_menu.trigger('_toggle') );
            }

            // create buttons with actions to apply on current selection
            if(this.selected_ids.length > 0) {
                let $container = $('<div/>').addClass('sb-view-header-list-actions-selected').appendTo($action_set);
                let count = this.selected_ids.length;

                let $fields_toggle_button = $('<div/>').addClass('mdc-menu-surface--anchor')
                .append( UIHelper.createButton('action-selected', count+' '+TranslationService.instant('SB_ACTIONS_BUTTON_SELECTED'), 'outlined') );

                let $list = UIHelper.createList('fields-list');
                let $menu = UIHelper.createMenu('fields-menu').addClass('sb-view-header-list-fields_toggle-menu');

                $menu.append($list);
                $fields_toggle_button.append($menu);

                // add actions defined in view
                for(let item of this.config.selection_actions) {
                    let $list_item = UIHelper.createListItem('SB_ACTION_ITEM-'+item.title, TranslationService.instant(item.title), item.icon)
                    .on( 'click', (event:any) => item.handler(this.selected_ids) )
                    .appendTo($list);

                    if(item.hasOwnProperty('primary') && item.primary) {
                        $container.append(UIHelper.createButton('selection-action-'+item.title, item.title, 'icon', item.icon).on('click', (event:any) => item.handler(this.selected_ids)));
                        let $tooltip = UIHelper.createTooltip('selection-action-'+item.title, TranslationService.instant(item.title));
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
    }

    private layoutFormHeader() {
        let $elem = $('<div />').addClass('sb-view-header-form');

        // container for holding chips of currently applied filters
        let $actions_set = $('<div />').addClass('sb-view-header-form-actions').appendTo($elem);

        // left side : standard actions for views
        let $std_actions = $('<div />').addClass('sb-view-header-form-actions-std').appendTo($actions_set);
        // right side : the actions specific to the view, and depenging on object status
        let $view_actions = $('<div />').addClass('sb-view-header-form-actions-view').appendTo($actions_set);

        switch(this.mode) {
            case 'view':
                $std_actions
                .append(
                    UIHelper.createButton('action-edit', TranslationService.instant('SB_ACTIONS_BUTTON_UPDATE'), 'raised')
                    .on('click', async () => {
                        await this.openContext({
                            entity: this.entity, type: this.type, name: this.name, domain: this.domain, mode: 'edit', purpose: 'update',
                            // for UX consistency, inject current view widget context (currently selected tabs, ...)
                            selected_sections: this.layout.getSelectedSections()
                        });
                    })
                );
                break;
            case 'edit':
                $std_actions
                .append(
                    UIHelper.createButton('action-save', TranslationService.instant('SB_ACTIONS_BUTTON_SAVE'), 'raised')
                    .on('click', async () => {
                        let objects;
                        if(this.purpose == 'create') {
                            // get the full collection, whatever the changes made by user
                            objects = await this.model.get();
                        }
                        else {
                            // get changed objects only
                            objects = this.model.getChanges();
                        }
                        if(!objects.length) {
                            // no change : close context
                            this.closeContext();
                        }
                        else {
                            // we're in edit mode for single object (form)
                            let object = objects[0];
                            try {
                                // update new object (set to instance)
                                const response = await ApiService.update(this.entity, [object['id']], this.model.export(object), false, this.getLang());
                                if(response && response.length) {
                                    // merge object with response (state and name fields might have changed)
                                    object = {...object, ...response[0]};
                                }
                                // relay new object_id to parent view
                                this.closeContext({selection: [object.id], objects: [object]});
                            }
                            catch(response) {
                                try {
                                    const res = await this.displayErrorFeedback(response, object, false);
                                    if(res !== false) {
                                        // relay new object_id to parent view
                                        this.closeContext({selection: [object.id], objects: [object]});
                                    }
                                }
                                catch(error) {

                                }
                            }
                        }
                    })
                )
                .append(
                    UIHelper.createButton('action-cancel', TranslationService.instant('SB_ACTIONS_BUTTON_CANCEL'), 'outlined')
                    .on('click', async () => {
                        let validation = true;
                        if(this.hasChanged()) {
                            validation = confirm(TranslationService.instant('SB_ACTIONS_MESSAGE_ABANDON_CHANGE'));
                        }
                        if(!validation) return;
                        this.closeContext();
                    })
                );
                break;
        }

        // attach elements to header toolbar
        this.$headerContainer.append( $elem );
    }


    private async layoutRefresh(full: boolean = false) {
        await this.layout.refresh(full);
        if(['list', 'cards'].indexOf(this.type) >= 0) {
            this.layoutListRefresh();
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

        $select_field = UIHelper.createSelect('bulk_assign_select_field', TranslationService.instant('SB_FILTERS_DIALOG_FIELD'), fields, Object.keys(fields)[0]).appendTo($elem);

        // setup handler for relaying value update to parent layout
        $select_field.find('input')
        .on('change', (event) => {
            let $this = $(event.currentTarget);
            selected_field = <string> $this.val();

            $elem.find('#bulk_assign_select_value').remove();

            let field_type = this.model.getFinalType(selected_field);

            switch(field_type) {
                case 'boolean':
                    $select_value = UIHelper.createSelect('bulk_assign_select_value', TranslationService.instant('SB_FILTERS_DIALOG_VALUE'), ['true', 'false']);
                    $select_value.find('input').on('change', (event) => {
                        let $this = $(event.currentTarget);
                        selected_value = ($this.children("option:selected").val() == 'true');
                    });
                    break;
                case 'date':
                case 'datetime':
                    // daterange selector
                    $select_value = UIHelper.createInput('bulk_assign_select_value', TranslationService.instant('SB_FILTERS_DIALOG_VALUE'), '');

                    $select_value.find('input').datepicker({
                        ...jqlocale[environment.locale],
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
// #todo - select amongst exisiting objects typeahead

                case 'string':
// #todo - display selection if any
                case 'integer':
                case 'float':
                default:
                    $select_value = UIHelper.createInput('bulk_assign_select_value', TranslationService.instant('SB_FILTERS_DIALOG_VALUE'), '');
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
                this.$layoutContainer.find('tr[data-id="'+object_id+'"]').trigger('_setValue', [selected_field, selected_value]);
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

        $dialog.on('_open', () => {
            $select_field.find('input').trigger('change');
        });

        let fields:any = {};

        for(let item of this.view_schema.layout.items ) {
            let label = (item.hasOwnProperty('label'))?item.label:item.value;
            fields[item.value] = TranslationService.resolve(this.translation, 'model', [], item.value, label, 'label');
        }

        $select_field = UIHelper.createSelect('custom_filter_select_field', TranslationService.instant('SB_FILTERS_DIALOG_FIELD'), fields, Object.keys(fields)[0]).appendTo($elem);
        // setup handler for relaying value update to parent layout
        $select_field.find('input')
        .on('change', (event) => {
            let $this = $(event.currentTarget);
            selected_field = <string> $this.val();

            $elem.find('#custom_filter_select_operator').remove();
            $elem.find('#custom_filter_select_value').remove();

            let field_type = this.model.getFinalType(selected_field);
            let operators:[] = this.model.getOperators(field_type);
            $select_operator = UIHelper.createSelect('custom_filter_select_operator', TranslationService.instant('SB_FILTERS_DIALOG_OPERATOR'), operators);
            // setup handler for relaying value update to parent layout
            $select_operator.find('input').on('change', (event) => {
                let $this = $(event.currentTarget);
                selected_operator = <string> $this.val();
            });



            switch(field_type) {
                case 'boolean':
                    $select_value = UIHelper.createSelect('custom_filter_select_value', TranslationService.instant('SB_FILTERS_DIALOG_VALUE'), ['true', 'false']);
                    $select_value.find('input').on('change', (event) => {
                        let $this = $(event.currentTarget);
                        selected_value = ($this.val() == 'true')?'1':'0';
                    });
                    break;
                case 'date':
                case 'datetime':
                    // daterange selector
                    $select_value = UIHelper.createInput('custom_filter_select_value', TranslationService.instant('SB_FILTERS_DIALOG_VALUE'), '');

                    $select_value.find('input').datepicker({
                        ...jqlocale[environment.locale],
                        onClose: () => {
                            $select_value.find('input').trigger('focus');
                        }
                    })
                    .on('change', (event:any) => {
                        // update widget value using jQuery `getDate`
                        let $this = $(event.currentTarget);
                        let date = $this.datepicker('getDate');
                        selected_value = date.toISOString();
                    });
                    /*
                    $select_value.daterangepicker({
                        opens: 'left'
                      }, (start:any, end:any) => {
                        selected_value = start.format('YYYY-MM-DD') + ' - ' + end.format('YYYY-MM-DD');
                        $select_value.find('input').val(selected_value);
                    });
                    */
                    break;
                case 'many2one':
                    // select amongst exisiting objects typeahead
                    break;
                case 'string':
                case 'integer':
                case 'float':
                default:
                    $select_value = UIHelper.createInput('custom_filter_select_value', TranslationService.instant('SB_FILTERS_DIALOG_VALUE'), '');
                    $select_value.find('input').on('change', (event) => {
                        let $this = $(event.currentTarget);
                        selected_value = <string> $this.val();
                    });
            }


            $elem.append($select_operator);
            $elem.append($select_value);
        })
        // init
        .trigger('change');


        $dialog.find('.mdc-dialog__content').append($elem);

        $dialog.on('_accept', () => {
            let operand = selected_field;
            let operator = selected_operator;
            let value = selected_value;

            if(selected_operator == 'like') {
                operator = 'ilike';
                value = '%'+selected_value+'%';
            }
            else if(selected_operator == 'in' || selected_operator == 'not in') {
                value = '['+selected_value+']';
            }

            let filter = {
                "id": "custom_filter_"+(Math.random()+1).toString(36).substr(2, 7),
                "label": "custom filter",
                "description": operand + ' ' + operator + ' ' + value,
                "clause": [operand, operator, value]
            };

            // add filter to View available filters
            this.filters[filter.id] = filter;

            let $filters_list =  this.$headerContainer.find('#filters-list');
            UIHelper.createListItem(filter.id, filter.description)
             .appendTo($filters_list)
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
     * Requested from layout when a change occured in the widgets.
     *
     * @param ids       array   one or more objecft identifiers
     * @param values    object   map of fields names and their related values
     */
    public async onchangeViewModel(ids: Array<any>, values: object, refresh: boolean = true) {
        this.model.change(ids, values);
        // model has changed : forms need to re-check the visibility attributes
        if(refresh) {
            await this.onchangeModel();
        }
    }

    /**
     * Callback for requesting a Layout update: the widgets in the layout need to be refreshed.
     * Requested from Model when a change occured in the Collection (as consequence of domain or params update)
     * If `full`is set to true, then the layout is re-generated
     * @param full  boolean
     */
    public async onchangeModel(full: boolean = false) {
        console.log('View::onchangeModel', full);
        await this.layoutRefresh(full);
    }

    /**
     * Callback for requesting a Model update.
     * Requested either from view: domain has been updated,
     * or from layout: context has been updated (sort column, sorting order, limit, page, ...)
     */
    public async onchangeView() {
        // reset selection
        // this.onchangeSelection([]);
        this.selected_ids = [];
        await this.model.refresh();
    }

    /**
     * Callback for list selection update.
     *
     * @param selection
     */
    public onchangeSelection(selection: Array<any>) {
        console.log('View::onchangeSelection', selection);
        this.selected_ids = selection;
        this.layoutListRefresh();
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
    private async applyFilter(filter_id:string) {
        let filter = this.filters[filter_id];
        let $filters_set = this.$headerContainer.find('.sb-view-header-list-filters-set');
        // make sure not to append a chip for same filter twice
        $filters_set.find('#'+filter_id).remove();
        $filters_set.append(
            UIHelper.createChip(filter.description)
            .attr('id', filter.id)
            .on('click', async (event) => {
                // unapply filter
                let $this = $(event.currentTarget)
                await this.unapplyFilter($this.attr('id'));
            })
        );
        this.applied_filters_ids.push(filter.id);
        this.setStart(0);
        this.onchangeView();
    }

    private async unapplyFilter(filter_id:any) {

        let index = this.applied_filters_ids.indexOf(filter_id);
        if (index > -1) {
            this.applied_filters_ids.splice(index, 1);
            delete this.filters[filter_id];

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

    private async actionBulkAssign(selection: any) {
        console.log('opening bulk assign dialog');
        this.$container.find('#bulk_assign_dialog').trigger('_open');
    }

    private async actionListInlineEdit(selection: any) {
        if(selection.length && !this.$container.find('.sb-view-header-list-actions-selected-edit').length) {
            this.$headerContainer.find('#'+'SB_ACTION_ITEM-'+'SB_ACTIONS_BUTTON_INLINE_UPDATE').hide();
            this.$headerContainer.find('#'+'SB_ACTION_ITEM-'+'SB_ACTIONS_BUTTON_BULK_ASSIGN').show();

            let $action_set = this.$container.find('.sb-view-header-list-actions-set');

            let $action_set_selected_edit_actions = $('<div/>').addClass('sb-view-header-list-actions-selected-edit');

            let $button_save = UIHelper.createButton('action-selected-edit-save', TranslationService.instant('SB_ACTIONS_BUTTON_SAVE'), 'raised').appendTo($action_set_selected_edit_actions);
            let $button_cancel = UIHelper.createButton('action-selected-edit-cancel', TranslationService.instant('SB_ACTIONS_BUTTON_CANCEL'), 'outlined').appendTo($action_set_selected_edit_actions);

            $action_set.append($action_set_selected_edit_actions);


            $button_save.on('click', () => {
                // handle changed objects
                let objects = this.model.getChanges(selection);

                let promises = [];

                for(let object_id of selection) {
                    let promise = new Promise( async (resolve, reject) => {
                        let object = objects.find( o => o.id == object_id );
                        this.$layoutContainer.find('tr[data-id="'+object_id+'"]').each( async (i: number, tr: any) => {
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
                                    // update the modfied field otherwise a confirmation will be displayed at next update
                                    if(Array.isArray(response) && response.length) {
                                        this.model.reset(object_id, response[0]);
                                    }
                                    resolve(true);
                                }
                                catch(response) {
                                    try {
                                        const res = await this.displayErrorFeedback(response, object, true);
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
                    this.$headerContainer.find('#'+'SB_ACTION_ITEM-'+'SB_ACTIONS_BUTTON_INLINE_UPDATE').show();
                    this.$headerContainer.find('#'+'SB_ACTION_ITEM-'+'SB_ACTIONS_BUTTON_BULK_ASSIGN').hide();
                })
                .catch( () => {

                })

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
                return false;
            });
        }

        for(let object_id of selection ) {

            this.$layoutContainer.find('tr[data-id="'+object_id+'"]').each( async (i: number, tr: any) => {
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

    /**
     *
     * This method can be invoked by methods from the Layout class.
     *
     * @param response
     * @param object
     * @param snack
     * @returns
     */
    public async displayErrorFeedback(response:any, object:any = null, snack:boolean = true) {
        if(response && response.hasOwnProperty('errors')) {
            let errors = response['errors'];

            if(errors.hasOwnProperty('INVALID_PARAM')) {
                let delay = 4000;
                let i = 0, count = Object.keys(errors['INVALID_PARAM']).length;
                // stack snackbars (LIFO: decreasing timeout)
                for(let field in errors['INVALID_PARAM']) {
                    // for each field, we handle one error at a time (the first one)
                    let error_id:string = <string>(Object.keys(errors['INVALID_PARAM'][field]))[0];
                    let msg:string = <string>(Object.values(errors['INVALID_PARAM'][field]))[0];
                    // translate error message
                    msg = TranslationService.resolve(this.translation, 'error', [], field, msg, error_id);
                    if(object) {
                        this.layout.markFieldAsInvalid(object['id'], field, msg);
                    }
                    if(snack) {
                        let title = TranslationService.resolve(this.translation, 'model', [], field, field, 'label');
                        let $snack = UIHelper.createSnackbar(title+': '+msg, '', '', delay * (count-i));
                        this.$container.append($snack);
                    }
                    ++i;
                }
            }
            else if(errors.hasOwnProperty('MISSING_PARAM')) {
                let msg = TranslationService.instant('SB_ERROR_CONFIG_MISSING_PARAM');
                let $snack = UIHelper.createSnackbar(msg + ' ' + errors['MISSING_PARAM'], 'Error', '', 4000);
                this.$container.append($snack);
            }
            else if(errors.hasOwnProperty('NOT_ALLOWED')) {
                let msg = TranslationService.instant('SB_ERROR_NOT_ALLOWED');
                let $snack = UIHelper.createSnackbar(msg, '', '', 4000);
                this.$container.append($snack);
            }
            else if(errors.hasOwnProperty('CONFLICT_OBJECT')) {
                // one or more fields violate a unique constraint
                if(typeof errors['CONFLICT_OBJECT'] == 'object') {
                    let delay = 4000;
                    let i = 0, count = Object.keys(errors['CONFLICT_OBJECT']).length;
                    for(let field in errors['CONFLICT_OBJECT']) {
                        let msg = TranslationService.instant('SB_ERROR_DUPLICATE_VALUE');
                        if(object) {
                            this.layout.markFieldAsInvalid(object['id'], field, msg);
                        }
                        if(snack) {
                            let title = TranslationService.resolve(this.translation, 'model', [], field, field, 'label');
                            let $snack = UIHelper.createSnackbar(title+': '+msg, '', '', delay * (count-i));
                            this.$container.append($snack);
                        }
                        ++i;
                    }
                }
                else if(errors['CONFLICT_OBJECT'] == 'concurrent_change') {
                    // object has been modified in the meanwhile
                    try {
                        await new Promise( (resolve, reject) => {
                            let confirmed = confirm(TranslationService.instant('SB_ACTIONS_MESSAGE_ERASE_CONUCRRENT_CHANGES'));
                            return confirmed ? resolve(true) : reject(false);
                        });
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
                        let title = TranslationService.instant('SB_ERROR_CONFLICT');
                        // try to resolve the error message
                        let msg = TranslationService.resolve(this.translation, 'error', [], 'errors', errors['CONFLICT_OBJECT'], errors['CONFLICT_OBJECT']);
                        let $snack = UIHelper.createSnackbar(title+': '+msg, 'Error', '', 4000);
                        this.$container.append($snack);
                    }
                }
            }
        }
        return false;
    }

}

export default View;