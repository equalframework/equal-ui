import { $ } from "../jquery-lib";
import { UIHelper } from '../material-lib';
import { Widget, WidgetFactory } from "../equal-widgets";
import { Layout, LayoutInterface } from './Layout';
import { TranslationService, ApiService, EnvService } from "../equal-services";
import { Domain, Clause, Condition, Reference } from "../Domain";
import moment from 'moment/moment.js';

export class LayoutList extends Layout {

    public async init() {
        console.debug('LayoutList::init');
        try {
            // initialize the layout
            this.layout();
        }
        catch(err) {
            console.warn('Something went wrong ', err);
        }
    }

    // refresh layout
    // this method is called in response to parent View `onchangeModel` method
    public async refresh(full: boolean = false) {
        console.debug('LayoutList::refresh');

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

    protected layout() {
        // create table

        // we define a tree structure according to MDC pattern
        let $elem = $('<div/>').addClass('table-wrapper').css({"width": "100%"})
        let $container = $('<div/>').css({"width": "100%"}).appendTo($elem);

        // add spinner
        $container.append( $('<div class="table-loader"> <div class="table-spinner"><div class="spinner__element"></div></div> <div class="table-overlay"></div> </div>') );

        let $table = $('<table/>').css({"width": "100%"}).appendTo($container);
        let $thead = $('<thead/>').appendTo($table);
        let $tbody = $('<tbody/>').appendTo($table);

        // instantiate header row and the first column which contains the 'select-all' checkbox
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

        let first_column: boolean = true;
        for(let item of view_schema.layout.items) {
            let field = item.value;
            let config = WidgetFactory.getWidgetConfig(this.view, field, translation, model_fields, view_fields);
            // append only visible columns
            if(config && (!config.hasOwnProperty('visible') || config.visible)) {
                let width = Math.floor(10 * item.width) / 10;
                let $cell = $('<th/>').attr('name', field)
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
                $cell.css({'text-align': config.align});
                if(config.align == 'right' || config.align == 'center') {
                    $cell.css({'padding-right': '16px'});
                }
                if(config.sortable) {
                    $cell.addClass('sortable').attr('data-sort', '');
                }
                $hrow.append($cell);
                first_column = false;
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
                        let field = item.value;
                        if(op_descriptor.hasOwnProperty(field)) {
                            let $input = $('<input>').attr('data-id', 'operation-'+operation+'-'+field);
                            let type = this.view.getModel().getFinalType(field);
                            if(['float', 'integer'].indexOf(type) >= 0 && field != 'id') {
                                $input.css({'text-align': 'right', 'padding-right': '16px'});
                            }
                            $cell.append( $input );
                        }
                        else if(pos == 0) {
                            $cell.append($title);
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

    protected async feed(objects: any) {
        console.debug('LayoutList::feed', objects);

        this.$layout.find("tbody").remove();

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
            if(stack.length == 0) {
                break;
            }

            let group = stack.pop();

            if(!group) {
                break;
            }

            // group is an array of objects: render a row for each object
            if( Array.isArray(group) ) {
                let parent_group_id = '';
                let $previous = $tbody.children().last();
                if($previous && $previous.hasClass('sb-group-row')) {
                    parent_group_id = <string> $previous.attr('data-id');
                }
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
                // #memo - keys must be strings
                let keys = Object.keys(group).sort().reverse();
                for(let key of keys) {
                    // ignore special keys (used for group properties)
                    if(key.charAt(0) == '_') {
                        continue;
                    }
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
                            let op_type = descriptor[item.value]['operation'];
                            let op_result:number = 0.0;
                            let i:number = 0;
                            for (let object of objects) {
                                switch(op_type) {
                                    case 'SUM':
                                        op_result += object[item.value];
                                        break;
                                    case 'COUNT':
                                        op_result += 1;
                                        break;
                                    case 'MIN':
                                        if(i == 0 || op_result > object[item.value]) {
                                            op_result = object[item.value];
                                        }
                                        break;
                                    case 'MAX':
                                        if(i == 0 || op_result < object[item.value]) {
                                            op_result = object[item.value];
                                        }
                                        break;
                                    case 'AVG':
                                        op_result += (object[item.value] - op_result) / (i+1);
                                        break;
                                }
                                ++i;
                            }
                            let value:any = op_result;
                            let prefix = '';
                            let suffix = '';
                            if(descriptor[item.value].hasOwnProperty('usage')) {
                                let usage = descriptor[item.value]['usage'];
                                if(usage.indexOf('amount/percent') >= 0 || usage.indexOf('amount/rate') >= 0) {
                                    suffix = '%';
                                    value = (value * 100).toFixed(0);
                                }
                                else if(usage.indexOf('amount/money') >= 0) {
                                    value = EnvService.formatCurrency(value);
                                }
                                else if(usage.indexOf('number/integer') >= 0 || usage.indexOf('numeric/integer') >= 0) {
                                    value = value.toFixed(0);
                                }
                                else if(usage.indexOf('number/real') >= 0) {
                                    value = EnvService.formatNumber(value);
                                }
                            }
                            else {
                                value = EnvService.formatNumber(value);
                            }
                            if(descriptor[item.value].hasOwnProperty('prefix')) {
                                prefix = descriptor[item.value]['prefix'];
                            }
                            if(descriptor[item.value].hasOwnProperty('suffix')) {
                                suffix = descriptor[item.value]['suffix'];
                            }
                            this.$layout.find('[data-id="'+'operation-'+operation+'-'+item.value+'"]').val(prefix+value+suffix);
                        }
                    }
                }
            }
        }

        UIHelper.decorateTable($elem);
    }

    private feedListGroupObjects(objects:any[], group_by:string[]) {
        let groups: any = {};
        let model_fields = this.view.getModelFields();

        // group objects
        for (let object of objects) {
            const n = group_by.length;
            let parent = groups;
            // #memo - we prepend parent_id to subgroups ids
            let parent_id = '';
            let level = 0;

            for(let i = 0; i < n; ++i) {
                let field, group:any = group_by[i];

                if(typeof group == 'object') {
                    if(!group.hasOwnProperty('field')) {
                        continue;
                    }
                    field = group.field;
                }
                else {
                    field = group;
                }

                let model_def = model_fields[field];
                let key = object[field];
                let label = key;

                if(key.hasOwnProperty('name')) {
                    label = key.name;
                    key = key.name;
                }

                if(['date', 'datetime'].indexOf(model_def['type']) >= 0) {
                    label = moment(key).format(moment.localeData().longDateFormat('L'));
                    key = moment(key).format('YYYY-MM-DD');
                }
                else if(model_def.hasOwnProperty('usage')) {
                    if(model_def.usage == 'date/month') {
                        // convert ISO8601 month (1-12) to js month  (0-11)
                        key = parseInt(key) - 1;
                        label = moment().month(key).format('MMMM');
                        key = String(key).padStart(2, '0');
                    }
                }

                if(!parent.hasOwnProperty(key)) {
                    if(i < n-1) {
                        //  no data (data are stored in children)
                        parent[key] = {'_id': parent_id+key, '_parent_id': parent_id, '_key': key, '_label': label, '_level': level};
                        if(typeof group == 'object' && group.hasOwnProperty('operation')) {
                            parent[key]['_operation'] = group.operation;
                        }
                    }
                    else {
                        parent[key] = {'_id': parent_id+key, '_parent_id': parent_id, '_key': key, '_label': label, '_level': level, '_data': []};
                        if(typeof group == 'object' && group.hasOwnProperty('operation')) {
                            parent[key]['_operation'] = group.operation;
                        }
                    }
                }
                parent_id = parent_id+key;
                parent = parent[key];
                ++level;
            }
            if( parent.hasOwnProperty('_data') && Array.isArray(parent['_data']) ) {
                parent['_data'].push(object);
            }
        }
        return groups;
    }

    /**
     *
     * @param object
     * @param parent_group_id A string used as DOM id that allows to retrieve parent node.
     * @returns
     */
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
            console.debug('Layout - received toggle_mode', mode);
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
                        console.debug('Layout - received _updatedWidget event', widget.getValue());
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
        let is_first:boolean = true;
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
                    value = (object[item.value] && object[item.value].hasOwnProperty('name'))?object[item.value]['name']:'';
                    config.object_id = (object[item.value] && object[item.value].hasOwnProperty('id'))?object[item.value]['id']:0;
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
            widget.setIsFirst(is_first);
            is_first = false;

            // store widget in widgets Map, using widget id as key (there are several rows for each field)
            if(typeof this.model_widgets[object.id] == 'undefined') {
                this.model_widgets[object.id] = {};
            }
            // store widget: use id and field as keys for storing widgets (current layout is for a single entity)
            this.model_widgets[object.id][item.value] = widget;

            let $cell = $('<td/>').addClass('sb-widget-cell').attr('data-type', config.type).attr('data-field', item.value).append(widget.render());

            $row.append($cell);
        }
        if(parent_group_id && parent_group_id.length) {
            $row.hide();
        }
        return $row;
    }

    private feedListCreateGroupRow(group:any, $tbody:any) {
        let schema = this.view.getViewSchema();

        let label:string = (group.hasOwnProperty('_label'))?group['_label']:'';
        let level:string = (group.hasOwnProperty('_level'))?group['_level']:'';
        let prefix:string = '';
        let suffix:string = '';

        let children_count = 0;
        let parent_group_id = group['_parent_id'];

        if(parent_group_id && parent_group_id.length > 0) {
            let $prev_td = $tbody.find("[data-id='" + parent_group_id + "']").find('.sb-group-cell-label').first();
            if($prev_td) {
                prefix = <string> $prev_td.attr('title') + ' › ';
            }
        }

        if(group.hasOwnProperty('_data')) {
            children_count = group['_data'].length;
        }

        if(group.hasOwnProperty('_operation')) {
            let op_type = group._operation[0];
            let op_field = (group._operation[1].split('.'))[1];
            let data: any[] = this.getGroupData(group, op_field);
            let op_result:number = 0;
            let i:number = 0;
            for(let val of data) {
                switch(op_type) {
                    case 'SUM':
                        op_result += val;
                        break;
                    case 'COUNT':
                        ++op_result;
                        break;
                    case 'MIN':
                        if(i == 0 || val < op_result) {
                            op_result = val;
                        }
                        break;
                    case 'MAX':
                        if(i == 0 || val > op_result) {
                            op_result = val;
                        }
                        break;
                    case 'AVG':
                        op_result += (val - op_result) / (i+1);
                        break;
                }
                ++i;
            }
            suffix = '['+op_result+']';
        }

        let $row = $('<tr/>')
            .addClass('sb-view-layout-list-row sb-group-row folded')
            .attr('data-parent-id', parent_group_id)
            .attr('data-id', group['_id'])
            .attr('data-key', group['_key'])
            .attr('data-label', group['_label'])
           .attr('data-level', group['_level'])
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

        $row.append( $('<td />').addClass('sb-group-cell').css({'padding-left': ''+(12+parseInt(level)*4)+'px)'}).append( $('<i/>').addClass('material-icons sb-toggle-button').text('chevron_right') ) );
        $row.append( $('<td/>')
                        .attr('title', prefix + label)
                        .attr('colspan', schema.layout.items.length)
                        .addClass('sb-group-cell sb-group-cell-label')
                        .append('<div style="display: flex;"> <div style="overflow: hidden;text-overflow: ellipsis;">'+prefix + ' <span>'+label+'</span></div>'+'<div style="font-weight: 500; margin-left: 20px;">'+suffix+'</div></div>')
                    );

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

        if(parent_group_id && parent_group_id.length) {
            $row.hide();
        }

        return $row;
    }

    private getGroupData(group: any, field: string) {
        let data: any[] = [];
        if(group.hasOwnProperty('_data')) {
            for(let obj of group['_data']) {
                if(obj.hasOwnProperty(field)) {
                    data.push(obj[field]);
                }
            }
        }
        else {
            let keys = Object.keys(group);
            for(let key of keys) {
                // ignore special keys (used for group properties)
                if(key.charAt(0) == '_') {
                    continue;
                }
                // add object or array
                data = [...data, ...this.getGroupData(group[key], field)];
            }
        }
        return data;
    }
}