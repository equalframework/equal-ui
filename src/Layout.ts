import { $ } from "./jquery-lib";

import { Widget, WidgetFactory } from "./equal-widgets";
import { UIHelper } from './material-lib';

import { TranslationService, ApiService } from "./equal-services";

import { Domain, Clause, Condition } from "./Domain";
import View from "./View";

/*
    There are two main branches of Layouts depending on what is to be displayed:
        - 1 single object : Form
        - several objects : List (grid, kanban, graph)

    Forms can be displayed in two modes : 'view' or 'edit'
    Lists can be editable on a Cell basis (using Widgets)
*/

export class Layout {

    private view: View;             // parent view the layout belongs to

    private $layout: any;

    private model_widgets: any;


    /**
     *
     * @param view  View    Parent View object
     */
    constructor(view:View) {
        this.view = view;
        this.$layout = $('<div />').addClass('sb-layout');
        this.model_widgets = {};
        this.view.$layoutContainer.append(this.$layout);
    }

    public async init() {
        console.log('Layout::init');
        try {
            // initialize the layout
            this.layout();
        }
        catch(err) {
            console.log('Something went wrong ', err);
        }
    }

    public getView() {
        return this.view;
    }

    /**
     * Relay Context opening requests to parent View.
     *
     * @param config
     */
    public openContext(config: any) {
        console.log("Layout::openContext", config);
        this.view.openContext(config);
    }

    /**
     *
     * @param field
     * @param message
     */
    public markFieldAsInvalid(object_id: number, field: string, message: string) {
        console.log('Layout::markFieldAsInvalid', object_id, field);
        if(this.view.getType() == 'form') {
            // by convention, form widgets are strored in first index
            object_id = 0;
        }
        if( this.model_widgets.hasOwnProperty(object_id) && this.model_widgets[object_id].hasOwnProperty(field) ) {
            let widget = this.model_widgets[object_id][field];
            let $elem = this.$layout.find('#'+widget.getId())
            $elem.addClass('mdc-text-field--invalid');
            $elem.find('.mdc-text-field-helper-text').addClass('mdc-text-field-helper-text--persistent mdc-text-field-helper-text--validation-msg').text(message).attr('title', message);
        }
    }

    public updateFieldValue(object_id: number, field: string, value: any) {
        let model_fields = this.view.getModelFields();

        if(!model_fields || !model_fields.hasOwnProperty(field)) {
            return null;
        }

        let def = model_fields[field];
        let type = def.type;
        if(def.hasOwnProperty('result_type')) {
            type = def.result_type;
        }

        if(['one2many', 'many2one', 'many2many'].indexOf(def.type) > -1) {
            // by convention, `name` subfield is always loaded for relational fields
            if(def.type == 'many2one') {
                value = value['name'];
            }
            else {
// #todo : this method should use the same logic as the feed* methods.
            }
        }

        if(this.model_widgets[object_id][field]) {
            this.model_widgets[object_id][field].setValue(value);
        }
    }

    // refresh layout
    // this method is called in response to parent View `onchangeModel` method
    public async refresh(full: boolean = false) {
        console.log('Layout::refresh');

        // also re-generate the layout
        if(full) {
            this.$layout.empty();
            this.layout();
        }

        // feed layout with current Model
        let objects = await this.view.getModel().get();
        this.feed(objects);
    }

    public getSelected() {
        var selection = <any>[];
        let $tbody = this.$layout.find("tbody");
        $tbody.find("input:checked").each( (i:number, elem:any) => {
            let data = $(elem).attr('data-id');
            if(data != undefined) {
                selection.push( parseInt(<string>data, 10) );
            }
        });
        return selection;
    }


    public getSelectedSections() {
        let selectedSections:any = {};
        this.$layout.find('.sb-view-form-group').each( (i:number, group: any) => {
            $(group).find('.sb-view-form-sections-tabbar').find('.sb-view-form-section-tab').each( (j:number, tab) => {
                if($(tab).hasClass('mdc-tab--active')) {
                    selectedSections[i] = j;
                }
            });
        });
        return selectedSections;
    }

    private layout() {
        console.log('Layout::layout');

        switch(this.view.getType()) {
            case 'form':
                this.layoutForm();
                break;
            case 'list':
                this.layoutList();
                break;
        }
    }

    private feed(objects: []) {
        console.log('Layout::feed');

        switch(this.view.getType()) {
            case 'form':
                this.feedForm(objects);
                break;
            case 'list':
                this.$layout.find("tbody").remove();
                this.feedList(objects);
                break;
        }
    }

    /**
     * Generate a widget config based on a layout item (from View schema)
     * @param field_name
     */
    private getWidgetConfig(item: any) {
        let config:any = {};

        let translation = this.view.getTranslation();
        let model_fields = this.view.getModelFields();

        let field = item.value;

        if(!model_fields || !model_fields.hasOwnProperty(field)) {
            return null;
        }

        let def = model_fields[field];

        let label = (item.hasOwnProperty('label'))?item.label:field;
        // #todo - handle help and relay to Context
        let helper = (item.hasOwnProperty('help'))?item.help:(def.hasOwnProperty('help'))?def['help']:'';
        let description = (item.hasOwnProperty('description'))?item.description:(def.hasOwnProperty('description'))?def['description']:'';

        if(def.hasOwnProperty('type')) {
            let type = def['type'];
            if(def.hasOwnProperty('result_type')) {
                type = def['result_type'];
            }
            if(def.hasOwnProperty('usage')) {
                switch(def.usage) {
                    // #todo - complete the list
                    case 'markup/html': 
                        type = 'text';
                        break;
                    case 'uri/url:http':
                    case 'uri/url':
                        type = 'link';
                        break;
                }
            }
            config.type = type;
        }
        else {
            // we shouldn't end up here : malformed schema
            console.log('ERROR - malformed schema for field '+field);
            return config;
        }

        if(def.hasOwnProperty('foreign_object')) {
            config.foreign_object = def.foreign_object;
        }

        if(def.hasOwnProperty('foreign_field')) {
            config.foreign_field = def.foreign_field;
        }

        if(def.hasOwnProperty('selection')) {
            config.selection = def.selection;
            config.type = 'select';
            let translated = TranslationService.resolve(translation, 'model', [], field, config.selection, 'selection');
            let values = translated;
            if(Array.isArray(translated)) {
                // convert array to a Map (original values as keys and translations as values)
                values = {};
                for(let i = 0, n = config.selection.length; i < n; ++i) {
                    values[config.selection[i]] = translated[i];
                }
            }
            config.values = values;
        }
        // ready property is set to true during the 'feed' phase
        config.visible = true;
        config.ready = false;
        config.title = TranslationService.resolve(translation, 'model', [], field, label, 'label');
        config.description = TranslationService.resolve(translation, 'model', [], field, description, 'description');
        config.readonly = (item.hasOwnProperty('readonly'))?item.readonly:(def.hasOwnProperty('readonly'))?def['readonly']:false;
        config.align = (item.hasOwnProperty('align'))?item.align:'left';
        config.sortable = (item.hasOwnProperty('sortable') && item.sortable);
        config.layout = this.view.getType();
        config.lang = this.view.getLang();

        if(item.hasOwnProperty('widget')) {
            // overload config with widget config, if any
            config = {...config, ...item.widget};
        }

        if(def.hasOwnProperty('visible')) {
            config.visible = def.visible;
        }

        if(item.hasOwnProperty('visible')) {
            config.visible = item.visible;
        }

        // convert visible property to JSON
        config.visible = eval(config.visible);

        // for relational fields, we need to check if the Model has been fetched al
        if(['one2many', 'many2one', 'many2many'].indexOf(config.type) > -1) {
            // defined config for Widget's view with a custom domain according to object values
            let view_id = (config.hasOwnProperty('view'))?config.view:'list.default';
            let parts = view_id.split(".", 2);
            let view_type = (parts.length > 1)?parts[0]:'list';
            let view_name = (parts.length > 1)?parts[1]:parts[0];

            let def_domain = (def.hasOwnProperty('domain'))?def['domain']:[];
            let view_domain = (config.hasOwnProperty('domain'))?config['domain']:[];

            let domain = new Domain(def_domain);
            domain.merge(new Domain(view_domain));

            // add join condition for limiting list to the current object
            if(['one2many', 'many2many'].indexOf(config.type) > -1 && def.hasOwnProperty('foreign_field')) {
                domain.merge(new Domain([def['foreign_field'], 'contains', 'object.id']));
            }

            config = {...config,
                entity: def['foreign_object'],
                view_type: view_type,
                view_name: view_name,
                original_domain: domain.toArray()
            };

        }

        return config;
    }

    /**
     *
     * This method also stores the list of instanciated widgets to allow switching from view mode to edit mode  (for a form or a cell)
     *
     */
    private layoutForm() {
        console.log('Layout::layoutForm');
        let $elem = $('<div/>').css({"width": "100%"});

        let view_schema = this.view.getViewSchema();
        let model_fields = this.view.getModelFields();
        let translation = this.view.getTranslation();
        let view_config = this.view.getConfig();

        $.each(view_schema.layout.groups, (i:number, group) => {
            let group_id = 'group-'+i;
            let $group = $('<div />').addClass('sb-view-form-group').appendTo($elem);

            // try to resolve the group title
            let group_title = (group.hasOwnProperty('label'))?group.label:'';
            if(group.hasOwnProperty('id')) {
                group_title = TranslationService.resolve(translation, 'view', [this.view.getId(), 'layout'], group.id, group_title);
            }
            // append the group title, if any
            if(group_title.length) {
                $group.append($('<div/>').addClass('sb-view-form-group-title').text(group_title));
            }

            let selected_section = 0;
            if(view_config && view_config.hasOwnProperty('selected_sections') && view_config.selected_sections.hasOwnProperty(i)) {
                selected_section = view_config.selected_sections[i];
            }

            let $tabs = UIHelper.createTabBar('sections-'+group_id, '', '').addClass('sb-view-form-sections-tabbar');

            if(group.sections.length > 1 ||  group.sections[0].hasOwnProperty('label')){
                $group.append($tabs);
            }

            $.each(group.sections, (j:number, section) => {
                let section_id = group_id+'-section-'+j;

                let $section = $('<div />').attr('id', section_id).addClass('sb-view-form-section mdc-layout-grid').appendTo($group);

                if(j != selected_section) {
                    $section.hide();
                }

                if(group.sections.length > 1 || section.hasOwnProperty('label')) {
                    // try to resolve the section title
                    let section_title = (section.hasOwnProperty('label'))?section.label:section_id;
                    if(section.hasOwnProperty('id')) {
                        section_title = TranslationService.resolve(translation, 'view', [this.view.getId(), 'layout'], section.id, section_title);
                    }

                    let $tab = UIHelper.createTabButton(section_id+'-tab', section_title, (j == selected_section)).addClass('sb-view-form-section-tab')
                    .on('click', () => {
                        $group.find('.sb-view-form-section').hide();
                        $group.find('#'+section_id).show();
                    });

                    if(section.hasOwnProperty('visible')) {
                        $tab.attr('data-visible', JSON.stringify(section.visible));
                    }    

                    $tabs.find('.sb-view-form-sections').append($tab);
                }


                $.each(section.rows, (k:number, row) => {
                    let $row = $('<div />').addClass('sb-view-form-row mdc-layout-grid__inner').appendTo($section);
                    $.each(row.columns, (l:number, column) => {
                        let $column = $('<div />').addClass('mdc-layout-grid__cell').appendTo($row);

                        if(column.hasOwnProperty('width')) {
                            $column.addClass('mdc-layout-grid__cell--span-' + Math.floor((parseInt(column.width, 10) / 100) * 12));
                        }

                        let $inner_cell = $('<div />').addClass('mdc-layout-grid__cell').appendTo($column);
                        $column = $('<div />').addClass('mdc-layout-grid__inner').appendTo($inner_cell);

                        $.each(column.items, (i, item) => {
                            let $cell = $('<div />').addClass('mdc-layout-grid__cell').appendTo($column);
                            // compute the width (on a 12 columns grid basis), from 1 to 12
                            let width = (item.hasOwnProperty('width'))?Math.floor((parseInt(item.width, 10) / 100) * 12): 12;
                            $cell.addClass('mdc-layout-grid__cell--span-' + width);

                            if(item.hasOwnProperty('type') && item.hasOwnProperty('value')) {
                                if(item.type == 'field') {

                                    let config = this.getWidgetConfig(item);

                                    if(config) {
                                        let widget:Widget = WidgetFactory.getWidget(this, config.type, config.title, '', config);
                                        widget.setReadonly(config.readonly);
                                        // store widget in widgets Map, using field name as key
                                        if(typeof this.model_widgets[0] == 'undefined') {
                                            this.model_widgets[0] = {};
                                        }
                                        this.model_widgets[0][item.value] = widget;
                                        $cell.append(widget.attach());
                                    }
                                }
                                else if(item.type == 'label') {
                                    let label_title = TranslationService.resolve(translation, 'view', [this.view.getId(), 'layout'], item.id, item.value);
                                    $cell.append('<span style="font-weight: 600;">'+label_title+'</span>');
                                }
                                else if(item.type == 'button') {
                                    $cell.append(UIHelper.createButton(item.action, item.value,  'raised', (item.icon)?item.icon:''));
                                }
                            }
                        });
                    });
                });
            });
            UIHelper.decorateTabBar($tabs);
        });


        this.$layout.append($elem);
    }

    private layoutList() {
        // create table

        // we define a tree structure according to MDC pattern
        let $elem = $('<div/>').css({"width": "100%"})
        let $container = $('<div/>').css({"width": "100%"}).appendTo($elem);

        let $table = $('<table/>').css({"width": "100%"}).appendTo($container);
        let $thead = $('<thead/>').appendTo($table);
        let $tbody = $('<tbody/>').appendTo($table);

        // instanciate header row and the first column which contains the 'select-all' checkbox
        let $hrow = $('<tr/>');

        if(this.view.getPurpose() != 'widget' || this.view.getMode() == 'edit') {
            UIHelper.createTableCellCheckbox(true)
            .appendTo($hrow)
            .find('input')
            .on('click', () => setTimeout( () => this.view.onchangeSelection(this.getSelected()) ) );
        }

        // create other columns, based on the col_model given in the configuration
        let schema = this.view.getViewSchema();

        // pre-processing: check columns width consistency
        let item_width_total = 0;

        // 1) sum total width and items with null width
        for(let item of schema.layout.items) {
            if(!item.hasOwnProperty('visible') || item.visible == true) {
                // set minimum width to 10%
                let width = 10;
                if(item.hasOwnProperty('width')) {
                    width = Math.round(parseInt(item.width, 10) * 100) / 100.0;
                    if(width < 10) width = 10;
                }
                item.width = width;
                item_width_total += width;
            }
        }
        // 2) normalize columns widths (to be exactly 100%)
        if(item_width_total != 100) {
            let ratio = 100.0 / item_width_total;
            for(let item of schema.layout.items) {
                if( (!item.hasOwnProperty('visible') || item.visible == true) && item.hasOwnProperty('width')) {
                    item.width *= ratio;
                }
            }
        }

        for(let item of schema.layout.items) {
            let config = this.getWidgetConfig(item);

            if(config.visible) {
                let width = Math.floor(10 * item.width) / 10;
                let $cell = $('<th/>').attr('name', item.value)
                .attr('width', width+'%')
                .append(config.title)
                .on('click', (event:any) => {
                    let $this = $(event.currentTarget);
                    if($this.hasClass('sortable')) {
                        // wait for handling of sort toggle
                        setTimeout( () => {
                            // change sortname and/or sortorder
                            this.view.setOrder(<string>$this.attr('name'));
                            this.view.setSort(<string>$this.attr('data-sort'));
                            this.view.onchangeView();
                            // unselect all lines
                            this.$layout.find('input[type="checkbox"]').each( (i:number, elem:any) => {
                                $(elem).prop('checked', false).prop('indeterminate', false);
                            });
                        }, 100);
                    }
                });

                if(config.sortable) {
                    $cell.addClass('sortable').attr('data-sort', 'asc');
                }
                $hrow.append($cell);
            }

        }

        $thead.append($hrow);

        this.$layout.append($elem);

        UIHelper.decorateTable($elem);
    }



    private feedList(objects: any) {
        console.log('Layout::feed', objects);

        let schema = this.view.getViewSchema();

        let $elem = this.$layout.children().first();
        $elem.find('tbody').remove();

        let $tbody = $('<tbody/>');

        for (let object of objects) {

            let $row = $('<tr/>')
            .addClass('sb-view-layout-list-row')
            .attr('data-id', object.id)
            .attr('data-edit', '0')
            // open form view on click
            .on('click', (event:any) => {
                let $this = $(event.currentTarget);
                // discard click when row is being edited
                if($this.attr('data-edit') == '0') {
                    this.openContext({entity: this.view.getEntity(), type: 'form', name: this.view.getName(), domain: ['id', '=', object.id]});
                }
            })
            // toggle mode for all cells in row
            .on( '_toggle_mode', (event:any, mode: string) => {
                let $this = $(event.currentTarget);

                $this.find('td.sb-widget-cell').each( (index: number, elem: any) => {
                    let $cell = $(elem);
                    let field:any = $cell.attr('data-field');
                    let widget = this.model_widgets[object.id][field];
                    // toggle mode
                    let mode = (widget.getMode() == 'view')?'edit':'view';
                    let $widget = widget.setMode(mode).render();
                    $cell.empty().append($widget);

                    if(mode == 'edit') {
                        $widget.on('_updatedWidget', (event:any) => {
                            let value:any = {};
                            value[field] = widget.getValue();
                            // propagate model change, without requesting a layout refresh
                            this.view.onchangeViewModel([object.id], value, false);
                        });
                    }
                });
            })
            // dispatch value setter
            .on( '_setValue', (event: any, field: string, value: any) => {
                let widget = this.model_widgets[object.id][field];
                widget.change(value);
            });

            // for lists in edit mode (excepted widgets), add a checkbox
            if(this.view.getPurpose() != 'widget' || this.view.getMode() == 'edit') {
                UIHelper.createTableCellCheckbox()
                .addClass('sb-view-layout-list-row-checkbox')
                .appendTo($row)
                .find('input')
                .attr('data-id', object.id)
                .on('click', (event:any) => {
                    // wait for widget to update and notify about change
                    setTimeout( () => this.view.onchangeSelection(this.getSelected()) );
                    // prevent handling of click on parent `tr` element
                    event.stopPropagation();
                });
            }

            // for each field, create a widget, append to a cell, and append cell to row
            for(let item of schema.layout.items) {

                let config = this.getWidgetConfig(item);

                // unknown or invisible field
                if(config === null || (config.hasOwnProperty('visible') && !config.visible)) continue;

                let value = object[item.value];

                // for relational fields, we need to check if the Model has been fetched
                if(['one2many', 'many2one', 'many2many'].indexOf(config.type) > -1) {

                    // if widget has a domain, parse it using current object and user
                    if(config.hasOwnProperty('original_domain')) {
                        let user = this.view.getUser();
                        let tmpDomain = new Domain(config.original_domain);
                        config.domain = tmpDomain.parse(object, user).toArray();
                    }
                    else {
                        config.domain = [];
                    }

                    // by convention, `name` subfield is always loaded for relational fields
                    if(config.type == 'many2one') {
                        value = object[item.value]['name'];
                        config.object_id = object[item.value]['id'];
                    }
                    else {
                        // Model do not load o2m and m2m fields : these are handled by sub-views
                        // value = object[item.value].map( (o:any) => o.name).join(', ');
                        // value = (value.length > 35)? value.substring(0, 35) + "..." : value;
                        value = "...";
                        // we need the current object id for new objects creation
                        config.object_id = object.id;
                    }
                }

                let widget:Widget = WidgetFactory.getWidget(this, config.type, '', '', config);
                widget.setValue(value);

                // store widget in widgets Map, using widget id as key (there are several rows for each field)
                if(typeof this.model_widgets[object.id] == 'undefined') {
                    this.model_widgets[object.id] = {};
                }
                // store widget: use id and field as keys for storing widgets (current layout is for a single entity)
                this.model_widgets[object.id][item.value] = widget;

                let $cell = $('<td/>').addClass('sb-widget-cell').attr('data-field', item.value).append(widget.render());

                $row.append($cell);
            }

            $tbody.append($row);
        }


        $elem.find('table').append($tbody);

        UIHelper.decorateTable($elem);
    }

    private feedForm(objects: any) {
        console.log('Layout::feedForm', objects);
        // display the first object from the collection

        let fields = Object.keys(this.view.getViewFields());
        let model_schema = this.view.getModelFields();

        // remember which element has focus (DOM is going to be modified)
        let focused_widget_id = $("input:focus").closest('.sb-widget').attr('id');

        if(objects.length > 0) {
// #todo : keep internal index of the object to display (with a prev/next navigation in the header)
            let object:any = objects[0];

            // update actions in view header
            let view_schema = this.view.getViewSchema();

            if(view_schema.hasOwnProperty('actions')) {
                let $view_actions = this.view.getContainer().find('.sb-view-header-form-actions-view');
                $view_actions.empty();
                for(let action of view_schema.actions) {
                    let visible = true;
                    if(action.hasOwnProperty('visible')) {
                        // visible attribute is a Domain
                        if(Array.isArray(action.visible)) {
                            let domain = new Domain(action.visible);
                            visible = domain.evaluate(object);
                        }
                        else {
                            visible = <boolean>action.visible;
                        }
                    }
                    if(visible) {
                        let action_title = TranslationService.resolve(this.view.getTranslation(), 'view', [this.view.getId(), 'actions'], action.id, action.label);
                        let $button = UIHelper.createButton('action-view-'+action.id, action_title, 'outlined')
                        .on('click', async () => {
                            var defer = $.Deferred();

                            // prompt for confirmation if required
                            if(action.hasOwnProperty('confirm') && action.confirm) {

                                // display confirmation dialog with checkbox for archive
                                let $dialog = UIHelper.createDialog('confirm_action_dialog', TranslationService.instant('SB_ACTIONS_CONFIRM'), TranslationService.instant('SB_DIALOG_ACCEPT'), TranslationService.instant('SB_DIALOG_CANCEL'));
                                $dialog.appendTo(this.view.getContainer());
                                // inject component as dialog content
                                $dialog.find('.mdc-dialog__content').append($('<p />').text(
                                    TranslationService.resolve(this.view.getTranslation(), 'view', [this.view.getId(), 'actions'], action.id, action.description, 'description')
                                ));

                                $dialog
                                .on('_accept', () => {
                                    defer.resolve();
                                })
                                .on('_reject', () => {
                                    defer.reject();
                                });

                                $dialog.trigger('_open');
                            }
                            else {
                                defer.resolve();
                            }

                            defer.promise().then( async () => {
                                try {
                                    const result = await ApiService.fetch("/", {do: action.controller, id: object.id});
                                    console.log(result);
                                    await this.view.onchangeView();
                                    // await this.view.getModel().refresh();
                                    // await this.refresh();
                                }
                                catch(response) {
                                    console.log('error', response);
                                    await this.view.displayErrorFeedback(response);
                                }
                            });

                        });
                        $view_actions.append($button);
                    }
                }
            }

            // update tabs visibility, if any
            let $tabs = this.$layout.find('.mdc-tab.sb-view-form-section-tab');
            $tabs.each( (i:number, elem:any) => {
                let $tab = $(elem);
                let visible = $tab.attr('data-visible');
                if(visible != undefined) {
                    console.log('section visible', visible);
                    let domain = new Domain(JSON.parse(visible));
                    if(domain.evaluate(object)) {
                        $tab.show();
                    }
                    else {
                        $tab.hide();
                    }
                }
            });

            for(let field of fields) {

                let widget = this.model_widgets[0][field];

                // widget might be missing (if not visible)
                if(!widget) continue;

                let $parent = this.$layout.find('#'+widget.getId()).parent();

                let model_def = model_schema[field];
                let type = model_def['type'];

                if(model_def.hasOwnProperty('result_type')) {
                    type = model_def['result_type'];
                }

                let has_changed = false;
                let value = (object.hasOwnProperty(field))?object[field]:undefined;
                let config = widget.getConfig();

                // for relational fields, we need to check if the Model has been fetched
                if(['one2many', 'many2one', 'many2many'].indexOf(type) > -1) {

                    // if widget has a domain, parse it using current object and user
                    if(config.hasOwnProperty('original_domain')) {
                        let user = this.view.getUser();
                        let tmpDomain = new Domain(config.original_domain);
                        config.domain = tmpDomain.parse(object, user).toArray();
                    }
                    else {
                        config.domain = [];
                    }

                    // by convention, `name` subfield is always loaded for relational fields
                    if(type == 'many2one') {
                        value = object[field]['name'];
                        config.object_id = object[field]['id'];
                    }
                    else if(type == 'many2many' || type == 'one2many') {
                        // init field if not present yet (o2m and m2m are not loaded by Model)
                        if(!object.hasOwnProperty(field)) {
                            object[field] = [];
                            // force change detection (upon re-feed, the field do not change and remains an empty array)
                            $parent.data('value', null);
                        }

                        // for m2m fields, the value of the field is an array of ids
                        // by convention, when a relation is to be removed, the id field is set to its negative value
                        value = object[field];

                        // select ids to load by filtering targeted objects
                        let ids_to_add = object[field].filter( (id:number) => id > 0 );
                        let ids_to_del = object[field].filter( (id:number) => id < 0 ).map( (id:number) => -id );

                        // we need the current object id for new objects creation
                        config.object_id = object.id;

                        // domain is updated based on user actions: an additional clause for + (accept thos whatever the other conditions) and addtional conditions for - (prevent theses whatever the other conditions)
                        let tmpDomain = new Domain(config.domain);
                        if(ids_to_add.length) {
                            tmpDomain.addClause(new Clause([new Condition("id", "in", ids_to_add)]));
                        }
                        if(ids_to_del.length) {
                            tmpDomain.addCondition(new Condition("id", "not in", ids_to_del));
                        }
                        config.domain = tmpDomain.toArray();
                    }
                }

                has_changed = (!value || $parent.data('value') != JSON.stringify(value));

                widget.setConfig({...config, ready: true})
                .setMode(this.view.getMode())
                .setValue(value);

                // store data to parent, for tracking changes at next refresh (prevent storing references)
                $parent.data('value', JSON.stringify(value));

                let visible = true;
                // handle visibility tests (domain)
                if(config.hasOwnProperty('visible')) {
                    // visible attribute is a Domain
                    if(Array.isArray(config.visible)) {
                        let domain = new Domain(config.visible);
                        visible = domain.evaluate(object);
                    }
                    else {
                        visible = <boolean>config.visible;
                    }
                }

                if(!visible) {
                    $parent.empty().append(widget.attach()).hide();
                    // visibility update need to trigger a redraw, whatever the value (so we change it to an arbitrary value)
                    $parent.data('value', null);
                }
                else {
                    let $widget = widget.render();
                    // Handle Widget update handler
                    $widget.on('_updatedWidget', (event:any, refresh: boolean = true) => {
                        console.log("Layout::feedForm : received _updatedWidget", field, widget.getValue());
                        // update object with new value
                        let value:any = {};
                        value[field] = widget.getValue();
                        this.view.onchangeViewModel([object.id], value, refresh);
                    });
                    // prevent refreshing objects that haven't changed
                    if(has_changed) {
                        // append rendered widget
                        $parent.empty().append($widget).show();
                    }
                }
            }
            // try to give the focus back to the previously focused widget
            $('#'+focused_widget_id).find('input').trigger('focus');
        }
    }

}

export default Layout;