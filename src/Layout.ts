import { $ } from "./jquery-lib";

import { Widget, WidgetFactory } from "./equal-widgets";
import { UIHelper } from './material-lib';

import { TranslationService, ApiService } from "./equal-services";

import { Domain, Clause, Condition, Reference } from "./Domain";
import View from "./View";
import moment from 'moment/moment.js';

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

    public loading(loading:boolean) {
        let $elem = this.$layout.find('.table-wrapper');
        let $loader = $elem.find('.table-loader');

        if(loading) {
            $loader.show();
        }
        else {
            $loader.hide();
        }
    }

    public getView() {
        return this.view;
    }

    public getEnv() {
        return this.view.getEnv();
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
        else {
            // unselect all
            $('td:first-child', this.$layout.find('tbody')).each( (i:number, elem:any) => { $('input[type="checkbox"]', elem).prop('checked', false) });
            this.$layout.find('thead').find('th:first-child').find('input').trigger('refresh');
        }

        // feed layout with current Model
        let objects = await this.view.getModel().get();
        this.feed(objects);
    }

    public getSelected() {
        var selection = <any>[];
        let $tbody = this.$layout.find("tbody");
        $tbody.find("input:checked").each( (i:number, elem:any) => {
            let id = $(elem).attr('data-id');
            if(id != undefined) {
                selection.push( parseInt(<string>id, 10) );
            }
        });
        return selection;
    }

    public setSelection(selection: Array<any>) {
        console.log('Layout::setSelection', selection);
        let $tbody = this.$layout.find("tbody");

        $tbody.find('input[type="checkbox"]').each( (i:number, elem:any) => {
            let data:any = $(elem).attr('data-id');
            if(data != undefined) {
                let id = parseInt(<string> data, 10);
                let $elem = $(elem);
                if(selection.indexOf(id) >= 0) {
                    $elem.prop('checked', true);
                    $elem.trigger('change');
                }
                else {
                    $elem.prop('checked', false);
                    $elem.trigger('change');
                }
            }
        });
    }

    public addToSelection(selection: Array<any>) {
        console.log('Layout::addToSelection', selection);
        let $tbody = this.$layout.find("tbody");

        $tbody.find('input[type="checkbox"]').each( (i:number, elem:any) => {
            let data:any = $(elem).attr('data-id');
            if(data != undefined) {
                let id = parseInt(<string> data, 10);
                let $elem = $(elem);
                if(selection.indexOf(id) >= 0) {
                    $elem.prop('checked', true);
                    $elem.trigger('change');
                }
            }
        });
        this.$layout.find('thead').find('th:first-child').find('input').trigger('refresh');
        setTimeout( () => this.view.onchangeSelection(this.getSelected()) );
    }

    public removeFromSelection(selection: Array<any>) {
        console.log('Layout::removeFromSelection', selection);
        let $tbody = this.$layout.find("tbody");

        $tbody.find('input[type="checkbox"]').each( (i:number, elem:any) => {
            let data:any = $(elem).attr('data-id');
            if(data != undefined) {
                let id = parseInt(<string> data, 10);
                let $elem = $(elem);
                if(selection.indexOf(id) >= 0) {
                    $elem.prop('checked', false);
                    $elem.trigger('change');
                }
            }
        });
        this.$layout.find('thead').find('th:first-child').find('input').trigger('refresh');
        setTimeout( () => this.view.onchangeSelection(this.getSelected()) );
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
     *
     * This method also stores the list of instanciated widgets to allow switching from view mode to edit mode  (for a form or a cell)
     *
     */
    private layoutForm() {
        console.log('Layout::layoutForm');
        let $elem = $('<div/>').css({"width": "100%"});

        let view_schema = this.view.getViewSchema();

        let view_fields = this.view.getViewFields();
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
                            $column.addClass('mdc-layout-grid__cell--span-' + Math.round((parseInt(column.width, 10) / 100) * 12));
                        }

                        if(column.hasOwnProperty('align') && column.align == 'right') {
                            $column.css({'margin-left': 'auto'});
                        }

                        let $inner_cell = $('<div />').addClass('mdc-layout-grid__cell').appendTo($column);
                        $column = $('<div />').addClass('mdc-layout-grid__inner').appendTo($inner_cell);

                        $.each(column.items, (i, item) => {
                            let $cell = $('<div />').addClass('mdc-layout-grid__cell').appendTo($column);
                            // compute the width (on a 12 columns grid basis), from 1 to 12
                            let width = (item.hasOwnProperty('width'))?Math.round((parseInt(item.width, 10) / 100) * 12): 12;
                            $cell.addClass('mdc-layout-grid__cell--span-' + width);

                            if(item.hasOwnProperty('type') && item.hasOwnProperty('value')) {
                                if(item.type == 'field') {

                                    let config = WidgetFactory.getWidgetConfig(this.view, item.value, translation, model_fields, view_fields);

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
                                    // #todo - create WidgetLabel, to be able to apply visibility rules on labels
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
        let $elem = $('<div/>').addClass('table-wrapper').css({"width": "100%"})
        let $container = $('<div/>').css({"width": "100%"}).appendTo($elem);

        // add spinner
        $container.append( $('<div class="table-loader"> <div class="table-spinner"><div class="spinner__element"></div></div> <div class="table-overlay"></div> </div>') );

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

        let group_by = this.view.getGroupBy();
        if(group_by.length > 0) {
            let $fold_toggle = $('<th />').addClass('sb-group-cell folded').css({'width': '44px', 'cursor': 'pointer'}).append( $('<i/>').addClass('material-icons sb-toggle-button').text('chevron_right') );
            $hrow.append( $fold_toggle );

            $fold_toggle.on('click', () => {
                console.log('fold click');
                let $tbody = this.$layout.find('tbody');
                let folded = $fold_toggle.hasClass('folded');
                if(folded) {
                    $fold_toggle.removeClass('folded');
                }
                else {
                    $fold_toggle.addClass('folded');
                }
                folded = !folded;
                $tbody.find('.sb-group-row').each( (index:number, elem:any) => {
                    let $this = $(elem);
                    let subfolded = $this.hasClass('folded');
                    if(subfolded != folded) {
                        $this.trigger('click');
                    }
                });
            });
        }

        // create other columns, based on the col_model given in the configuration
        let view_schema = this.view.getViewSchema();
        let translation = this.view.getTranslation();

        let model_fields = this.view.getModelFields();
        let view_fields = this.view.getViewFields();

        // pre-processing: check columns width consistency
        let item_width_total = 0;

        // 1) sum total width and items with null width
        for(let item of view_schema.layout.items) {
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
            for(let item of view_schema.layout.items) {
                if( (!item.hasOwnProperty('visible') || item.visible == true) && item.hasOwnProperty('width')) {
                    item.width *= ratio;
                }
            }
        }

        for(let item of view_schema.layout.items) {
            let config = WidgetFactory.getWidgetConfig(this.view, item.value, translation, model_fields, view_fields);

            if(config.visible) {
                let width = Math.floor(10 * item.width) / 10;
                let $cell = $('<th/>').attr('name', item.value)
                // .attr('width', width+'%')
                .css({width: width+'%'})
                .append(config.title)
                .on('click', (event:any) => {
                    let $this = $(event.currentTarget);
                    if($this.hasClass('sortable')) {
                        // unselect all lines
                        $('td:first-child', this.$layout.find('tbody')).each( (i:number, elem:any) => {
                            $('input[type="checkbox"]', elem).prop('checked', false).prop('indeterminate', false);
                        });
                        $thead.find('th:first-child').find('input').trigger('refresh');

                        // wait for handling of sort toggle (table decorator)
                        setTimeout( () => {
                            // change sortname and/or sortorder
                            this.view.setOrder(<string>$this.attr('name'));
                            this.view.setSort(<string>$this.attr('data-sort'));
                            this.view.onchangeView();
                        });
                    }
                });

                if(config.sortable) {
                    $cell.addClass('sortable').attr('data-sort', '');
                }
                $hrow.append($cell);
            }

        }

        $thead.append($hrow);

        this.$layout.append($elem);

        if(view_schema.hasOwnProperty('operations')) {
            let $operations = $('<div>').addClass('table-operations');
            for(let operation in view_schema.operations) {
                let op_descriptor = view_schema.operations[operation];

                let $op_div = $('<div>').addClass('operation');
                let $title = $('<div>').addClass('operation-title').text(operation);

                // $op_div.append($title);
                let $op_row = $('<div>').addClass('operation-row').appendTo($op_div);
                let pos = 0;
                for(let item of view_schema.layout.items) {
                    if(!item.hasOwnProperty('visible') || item.visible == true) {
                        let width = Math.ceil(10 * item.width) / 10;
                        let $cell = $('<div>').addClass('operation-cell').css({width: width+'%'});
                        if(op_descriptor.hasOwnProperty(item.value)) {
                            $cell.append( $('<input>').attr('type', 'number').attr('data-id', 'operation-'+operation+'-'+item.value) );
                        }
                        else {
                            if(pos == 0) {
                                $cell.append($title);
                            }
                        }
                        $op_row.append($cell);
                    }
                    ++pos;
                }

                $operations.append($op_div);
            }
            $elem.append($operations);
        }

        UIHelper.decorateTable($elem);

        if(view_schema.hasOwnProperty('actions') && this.view.getPurpose() != 'widget') {
            let $view_actions = this.view.getContainer().find('.sb-view-header-actions-view');

            for(let action of view_schema.actions) {

                let action_title = TranslationService.resolve(this.view.getTranslation(), 'view', [this.view.getId(), 'actions'], action.id, action.label);
                let $button = UIHelper.createButton('action-view-'+action.id, action_title, 'outlined')

                this.decorateActionButton($button, action);

                $view_actions.append($button);
            }
        }
    }


    private feedList(objects: any) {
        console.log('Layout::feedList', objects);

        let group_by = this.view.getGroupBy();

        let groups:any = {};

        if(group_by.length > 0) {
            groups = this.feedListGroupObjects(objects, group_by);
        }

        let schema = this.view.getViewSchema();

        let $elem = this.$layout.find('.table-wrapper');
        let $table = $elem.find('table');

        let $tbody = $('<tbody/>');

        let stack = (group_by.length == 0)?[objects]:[groups];

        while(true) {
            if(stack.length == 0) break;

            let group = stack.pop();

            if( Array.isArray(group) ) {
                let $previous = $tbody.children().last();
                let parent_group_id = '';
                if($previous && $previous.hasClass('sb-group-row')) {
                    parent_group_id = <string> $previous.attr('data-id');
                }

                // group is an array of objects: render a row for each object
                for (let object of group) {
                    let $row = this.feedListCreateObjectRow(object, parent_group_id);
                    $tbody.append($row);
                }
            }
            else if(group.hasOwnProperty('_is_group')) {
                let $row = this.feedListCreateGroupRow(group, $tbody);
                $tbody.append($row);
            }
            else {
                let keys = Object.keys(group).sort().reverse();
                for(let key of keys) {
                    if(['_id', '_parent_id', '_key', '_label'].indexOf(key) >= 0) continue;
                    // add object or array
                    if(group[key].hasOwnProperty('_data')) {
                        stack.push(group[key]['_data']);
                    }
                    else {
                        stack.push(group[key]);
                    }
                    stack.push({'_is_group': true, ...group[key]});
                }
            }
        }

        $table.find('tbody').remove();
        $table.append($tbody);

        if(schema.hasOwnProperty('operations')) {

            for(let operation in schema.operations) {
                let descriptor = schema.operations[operation];

                for(let item of schema.layout.items) {
                    if(!item.hasOwnProperty('visible') || item.visible == true) {

                        if(descriptor.hasOwnProperty(item.value)) {
                            let type = descriptor[item.value].type;
                            let result:number = 0.0;
                            for (let object of objects) {
                                switch(type) {
                                    case 'SUM':
                                        result += object[item.value];
                                        break;
                                    case 'COUNT':
                                        result += 1;
                                        break;
                                    case 'MIN':
                                        break;
                                    case 'MAX':
                                        break;
                                    case 'AVG':
                                        break;
                                }
                            }
                            let value = String( (Math.round(result * 100) / 100).toFixed(2) );
                            this.$layout.find('[data-id="'+'operation-'+operation+'-'+item.value+'"]').val(value);
                        }
                    }
                }
            }
        }

        UIHelper.decorateTable($elem);
    }

    private feedForm(objects: any) {
        console.log('Layout::feedForm', objects);
        // display the first object from the collection

        let fields = Object.keys(this.view.getViewFields());
        let model_fields = this.view.getModelFields();

        // remember which element has focus (DOM is going to be modified)
        let focused_widget_id = $("input:focus").closest('.sb-widget').attr('id');

        if(objects.length > 0) {
            // #todo - keep internal index of the object to display (with a prev/next navigation in the header)
            let object:any = objects[0];

            // update actions in view header
            let view_schema = this.view.getViewSchema();


            if(view_schema.hasOwnProperty('actions')) {
                let $view_actions = this.view.getContainer().find('.sb-view-header-actions-view');
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
                        this.decorateActionButton($button, action, object);
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

                let model_def = model_fields[field];
                let type = model_def['type'];

                if(model_def.hasOwnProperty('result_type')) {
                    type = model_def['result_type'];
                }

                let has_changed = false;
                let value = (object.hasOwnProperty(field))?object[field]:undefined;
                let config = widget.getConfig();

                // for relational fields, we need to check if the Model has been fetched
                if(['one2many', 'many2one', 'many2many'].indexOf(type) > -1) {
                    let user = this.view.getUser();

                    // if widget has a domain, parse it using current object and user
                    if(config.hasOwnProperty('original_domain')) {
                        let tmpDomain = new Domain(config.original_domain);
                        config.domain = tmpDomain.parse(object, user).toArray();
                    }
                    else {
                        config.domain = [];
                    }

                    // if widget has a custom header defintion, parse subsequent domains, if any
                    if(config.hasOwnProperty('header') && config.header.hasOwnProperty('actions') ) {
                        for (const [id, items] of Object.entries(config.header.actions)) {
                            for(let index in (<Array<any>>items)) {
                                let item = (<Array<any>>items)[<any>index];
                                if(item.hasOwnProperty('domain')) {
                                    let tmpDomain = new Domain(item.domain);
                                    config.header.actions[id][index].domain = tmpDomain.parse(object, user).toArray();
                                }
                            }
                        }
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

                        // domain is updated based on user actions: an additional clause for + (accept these whatever the other conditions) and addtional conditions for - (prevent these whatever the other conditions)
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
                $parent.data('value', JSON.stringify(value) || null);

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
                    $widget.on('_updatedWidget', async (event:any, refresh: boolean = true) => {
                        console.log("Layout::feedForm : received _updatedWidget", field, widget.getValue(), refresh);
                        // update object with new value
                        let values:any = {};
                        values[field] = widget.getValue();
                        // relay the change to back-end through onupdate
                        try {
                            const result = await ApiService.fetch("/", {do: 'model_onchange', entity: this.view.getEntity(), changes: this.view.getModel().export(values), values: this.view.getModel().export(object), lang: this.view.getLang()} );
                            for(let field of Object.keys(result)) {
                                // if some changes are returned from the back-end, append them to the view model update
                                values[field] = result[field];
                            }
                        }
                        catch(response) {
                            // ignore faulty responses
                        }
                        this.view.onchangeViewModel([object.id], values, refresh);
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

    private feedListGroupObjects(objects:any[], group_by:string[]) {
        let groups: any = {};
        let model_fields = this.view.getModelFields();

        // group objects
        for (let object of objects) {
            const n = group_by.length;
            let parent = groups;
            let parent_id = '';

            for(let i = 0; i < n; ++i) {
                let field = group_by[i];
                let model_def = model_fields[field];
                let key = object[field];
                let label = key;

                if(key.hasOwnProperty('name')) {
                    label = key.name;
                    key = key.name;
                }

                if(['date', 'datetime'].indexOf(model_def['type']) >= 0) {
                    label = moment(key).format(moment.localeData().longDateFormat('L'));
                    key = moment(key).format('YYYY-MM-DD')
                }

                if(!parent.hasOwnProperty(key)) {
                    if(i < n-1) {
                        parent[key] = {'_id': parent_id+key, '_parent_id': parent_id, '_key': key, '_label': label};
                    }
                    else {
                        parent[key] = {'_id': parent_id+key, '_parent_id': parent_id, '_key': key, '_label': label, '_data': []};
                    }
                }
                parent_id = parent_id+key;
                parent = parent[key];
            }
            if( parent.hasOwnProperty('_data') && Array.isArray(parent['_data']) ) {
                parent['_data'].push(object);
            }
        }
        return groups;
    }

    private feedListCreateObjectRow(object:any, parent_group_id:string) {
        let schema = this.view.getViewSchema();

        let view_fields = this.view.getViewFields();
        let model_fields = this.view.getModelFields();
        let translation = this.view.getTranslation();

        let group_by = this.view.getGroupBy();

        let $row = $('<tr/>')
        .addClass('sb-view-layout-list-row')
        .attr('data-parent-id', parent_group_id)
        .attr('data-id', object.id)
        .attr('data-edit', '0')
        // open form view on click
        .on('click', (event:any) => {
            let $this = $(event.currentTarget);
            // discard click when row is being edited
            if($this.attr('data-edit') == '0') {
                // #todo - allow overloading default action ('ACTIONS.UPDATE')
                this.openContext({entity: this.view.getEntity(), type: 'form', name: this.view.getName(), domain: ['id', '=', object.id]});
            }
        })
        // toggle mode for all cells in row
        .on( '_toggle_mode', (event:any, mode: string = 'view') => {
            console.log('Layout - received toggle_mode', mode);
            let $this = $(event.currentTarget);

            $this.find('td.sb-widget-cell').each( (index: number, elem: any) => {
                let $cell = $(elem);
                let field:any = $cell.attr('data-field');
                let widget = this.model_widgets[object.id][field];

                // switch to given mode
                if(widget.getMode() == mode) return;
                let $widget = widget.setMode(mode).render();

                // handle special situations that allow cell content to overflow
                if(widget.getType() == 'boolean') {
                    $cell.addClass('allow-overflow');
                }

                $cell.empty().append($widget);

                if(mode == 'edit') {
                    $widget.on('_updatedWidget', (event:any) => {
                        console.log('Layout - received _updatedWidget event', widget.getValue());
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

        if(group_by.length > 0) {
            // add a cell for the toggle chevron column
            $row.append( $('<td/>') );
        }

        // for each field, create a widget, append to a cell, and append cell to row
        for(let item of schema.layout.items) {

            let config = WidgetFactory.getWidgetConfig(this.view, item.value, translation, model_fields, view_fields);

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
            widget.setReadonly(config.readonly);

            // store widget in widgets Map, using widget id as key (there are several rows for each field)
            if(typeof this.model_widgets[object.id] == 'undefined') {
                this.model_widgets[object.id] = {};
            }
            // store widget: use id and field as keys for storing widgets (current layout is for a single entity)
            this.model_widgets[object.id][item.value] = widget;

            let $cell = $('<td/>').addClass('sb-widget-cell').attr('data-field', item.value).append(widget.render());

            $row.append($cell);
        }
        if(parent_group_id.length) {
            $row.hide();
        }
        return $row;
    }

    private feedListCreateGroupRow(group:any, $tbody:any) {
        let schema = this.view.getViewSchema();

        let label:string = group['_label'];
        let prefix:string = '';
        let suffix:string = '';

        let children_count = 0;
        let parent_group_id = group['_parent_id'];

        if(parent_group_id.length > 0) {
            let $prev_td = $tbody.find("[data-id='" + parent_group_id + "']").find('.sb-group-cell-label').first();
            if($prev_td) {
                prefix = <string> $prev_td.attr('title') + ' › ';
            }
        }

        if(group.hasOwnProperty('_data')) {
            children_count = group['_data'].length;
            suffix = '['+children_count+']';
        }
        else {
            // sum children groups
        }

        let $row = $('<tr/>')
        .addClass('sb-view-layout-list-row sb-group-row folded')
        .attr('data-parent-id', parent_group_id)
        .attr('data-id', group['_id'])
        .attr('data-children-count', children_count)
        .attr('id', UIHelper.getUUID());

        if(this.view.getPurpose() != 'widget' || this.view.getMode() == 'edit') {
            let $checkbox = UIHelper.createTableCellCheckbox().addClass('sb-view-layout-list-row-checkbox');
            $checkbox.find('input').on('click', (event:any) => {
                event.stopPropagation();

                let $tbody = this.$layout.find('tbody');
                let checked = $checkbox.find('input').prop('checked');

                let selection:any[] = [];

                $tbody.find("[data-parent-id='" + group['_id'] + "']").each( (index:number, elem:any) => {
                    let $this = $(elem);
                    if($this.hasClass('sb-group-row')) {
                        let subchecked = $this.children().first().find('input').prop('checked');
                        if(checked != subchecked) {
                            $this.children().first().find('input').trigger('click');
                        }
                    }
                    else {
                        selection.push(parseInt(<string>$this.children().first().find('input').attr('data-id'), 10));
                    }
                });

                if(checked) {
                    this.addToSelection(selection);
                }
                else {
                    this.removeFromSelection(selection);
                }
            });
            $row.append($checkbox);
        }

        $row.append( $('<td />').addClass('sb-group-cell').append( $('<i/>').addClass('material-icons sb-toggle-button').text('chevron_right') ) );
        $row.append( $('<td/>').attr('title', prefix + label).attr('colspan', schema.layout.items.length).addClass('sb-group-cell sb-group-cell-label').append(prefix + ' <span>'+label+'</span>'+' '+suffix) );

        $row.on('click', () => {
            let $tbody = this.$layout.find('tbody');
            let group_id = $row.attr('data-id');
            if($row.hasClass('folded')){
                $row.removeClass('folded');
                $tbody.find("[data-parent-id='" + group_id + "']").each( (index:number, elem:any) => {
                    let $this = $(elem);
                    if($this.hasClass('sb-group-row')) {
                        $this.trigger('show');
                    }
                    else {
                        $this.show();
                    }
                });
            }
            else {
                $row.addClass('folded');
                $tbody.find("[data-parent-id='" + group_id + "']").each( (index:number, elem:any) => {
                    let $this = $(elem);
                    if($this.hasClass('sb-group-row')) {
                        $this.trigger('hide');
                    }
                    else {
                        $this.hide();
                    }
                });
            }
        });

        $row.on('show', () => {
            let $tbody = this.$layout.find('tbody');

            let group_id = $row.attr('data-id');
            $row.show();
            $tbody.find("[data-parent-id='" + group_id + "']").each( (index:number, elem:any) => {
                let $this = $(elem);
                if($this.hasClass('sb-group-row')) {
                    // $this.trigger('show');
                }
                else if(!$row.hasClass('folded')) {
                    $this.show();
                }
            });
        });

        $row.on('hide', () => {
            let $tbody = this.$layout.find('tbody');
            let group_id = $row.attr('data-id');
            $row.hide();
            $tbody.find("[data-parent-id='" + group_id + "']").each( (index:number, elem:any) => {
                let $this = $(elem);
                if($this.hasClass('sb-group-row')) {
                    $this.trigger('hide');
                }
                else {
                    $this.hide();
                }
            });
        });

        if(parent_group_id.length) {
            $row.hide();
        }

        return $row;
    }

    private async decorateActionButton($button: JQuery, action: any, object: any = {}) {
        $button.on('click', async () => {
            // mark action button as loading
            $button.addClass('mdc-button--spinner').attr('disabled', 'disabled');

            let resulting_params:any = {};
            let missing_params:any = {};
            let user = this.view.getUser();

            // pre-feed with params from the action, if any
            if(action.hasOwnProperty('params')) {
                for(let param of Object.keys(action.params)) {
                    let ref = new Reference(action.params[param]);
                    resulting_params[param] = ref.parse(object, user);
                }
            }

            // retrieve announcement from the target action controller
            const result = await ApiService.fetch("/", {do: action.controller, announce: true});
            let params: any = {};
            if(result.hasOwnProperty('announcement')) {
                if(result.announcement.hasOwnProperty('params')) {
                    params = result.announcement.params;
                }
                for(let param of Object.keys(params)) {
                    if(Object.keys(resulting_params).indexOf(param) < 0) {
                        missing_params[param] = params[param];
                    }
                }
            }
            // retrieve translation related to action, if any
            let translation = await ApiService.getTranslation(action.controller.replaceAll('_', '\\'), this.view.getLocale());

            // restore action button
            $button.removeClass('mdc-button--spinner').removeAttr('disabled');


            let defer = $.Deferred();
            let $description = $('<p />').text( TranslationService.resolve(translation, '', [], '', action.description, 'description'));

            if(action.hasOwnProperty('confirm') && action.confirm) {
                // params dialog
                if(Object.keys(missing_params).length) {
                    let $dialog = UIHelper.createDialog(this.view.getUUID()+'_'+action.id+'_custom_action_dialog', TranslationService.instant('SB_ACTIONS_PROVIDE_PARAMS'), TranslationService.instant('SB_DIALOG_SEND'), TranslationService.instant('SB_DIALOG_CANCEL'));
                    $dialog.find('.mdc-dialog__content').append($description);
                    await this.decorateViewActionDialog($dialog, action, missing_params);
                    $dialog.addClass('sb-view-dialog').appendTo(this.view.getContainer());
                    $dialog
                    .on('_accept', () => defer.resolve($dialog.data('result')))
                    .on('_reject', () => defer.reject() );
                    $dialog.trigger('_open');
                }
                // confirm dialog
                else {
                    // display confirmation dialog with checkbox for archive
                    let $dialog = UIHelper.createDialog(this.view.getUUID()+'_'+action.id+'_confirm-action-dialog', TranslationService.instant('SB_ACTIONS_CONFIRM'), TranslationService.instant('SB_DIALOG_ACCEPT'), TranslationService.instant('SB_DIALOG_CANCEL'));
                    $dialog.find('.mdc-dialog__content').append($description);
                    $dialog.appendTo(this.view.getContainer());
                    $dialog
                    .on('_accept', () => defer.resolve())
                    .on('_reject', () => defer.reject() );
                    $dialog.trigger('_open');
                }
            }
            else {
                // params dialog
                if(Object.keys(missing_params).length) {
                    let $dialog = UIHelper.createDialog(this.view.getUUID()+'_'+action.id+'_custom_action_dialog', TranslationService.instant('SB_ACTIONS_PROVIDE_PARAMS'), TranslationService.instant('SB_DIALOG_SEND'), TranslationService.instant('SB_DIALOG_CANCEL'));
                    $dialog.find('.mdc-dialog__content').append($description);
                    await this.decorateViewActionDialog($dialog, action, missing_params);
                    $dialog.addClass('sb-view-dialog').appendTo(this.view.getContainer());
                    $dialog
                    .on('_accept', () => defer.resolve($dialog.data('result')))
                    .on('_reject', () => defer.reject() );
                    $dialog.trigger('_open');
                }
                // perform action
                else {
                    defer.resolve()
                }
            }

            defer.promise().then( async (result:any) => {
                this.performViewAction(action, {...resulting_params, ...result}, translation);
            });


        });

    }

    private async decorateViewActionDialog($dialog: JQuery, action: any, params: any) {
        let $elem = $('<div />');

        let widgets:any = {};

        // load translation related to controller
        let translation = await ApiService.getTranslation(action.controller.replaceAll('_', '\\'), this.view.getLocale());

        for(let field of Object.keys(params)) {

            let def = params[field];

            let model_fields:any = {};
            model_fields[field] = def;

            let view_fields:any = {};
            view_fields[field] =  {
                "type": "field",
                "value": field
            };

            let config = WidgetFactory.getWidgetConfig(this.view, field, translation, model_fields, view_fields);

            let widget:Widget = WidgetFactory.getWidget(this, config.type, config.title, '', config);
            widget.setMode('edit');
            widget.setReadonly(config.readonly);

            let $node = widget.render();
            $node.css({'margin-bottom': '24px'});
            $elem.append($node);
            widgets[field] = widget;
        }

        $dialog.find('.mdc-dialog__content').append($elem);

        $dialog.on('_accept', () => {
            let result:any = {};
            // send payload to target controller

            // read result :
            // if no error refresh view
            // otherwise display error
            for(let field of Object.keys(widgets)) {
                let widget = widgets[field];
                result[field] = widget.getValue();
            }
            $dialog.data('result', result);
        });

    }


    private async performViewAction(action:any, params:any, translation: any) {

        try {
            const result = await ApiService.fetch("/", {do: action.controller, ...params});
            console.log(result);
            await this.view.onchangeView();
            // await this.view.getModel().refresh();
            // await this.refresh();
        }
        catch(response) {
            console.log('error', response);
            await this.view.displayErrorFeedback(translation, response);
        }
    }


}

export default Layout;