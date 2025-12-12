import { $ } from "../jquery-lib";
import { UIHelper } from '../material-lib';
import { Layout } from './Layout';
import { Widget } from '../equal-widgets';
import { TranslationService, ApiService, EnvService } from "../equal-services";
import { WidgetDashboardItem } from "../widgets/WidgetDashboardItem";
import { Domain, Clause, Condition, Reference } from "../Domain";

export class LayoutDashboard extends Layout {

    public async init() {
        console.debug('LayoutDashboard::init');
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
        console.debug('LayoutDashboard::refresh');

        // also re-generate the layout
        if(full) {
            this.$layout.empty();
            this.layout();
        }
        // feed layout (render widgets)
        this.feed([]);
    }

    /**
     *
     * This method also stores the list of instanciated widgets to allow switching from view mode to edit mode  (for a form or a cell)
     *
     */
    protected layout() {
        console.debug('LayoutDashboard::layout');

        let $elem = $('<div/>').css({"width": "100%"});

        let view_schema = this.view.getViewSchema();


        let translation = this.view.getTranslation();
        let view_config = this.view.getConfig();

        if(!view_schema.hasOwnProperty('layout') || !view_schema.layout.hasOwnProperty('groups')) {
            console.warn("invalid layout, stop processing");
            return;
        }

        $.each(view_schema.layout.groups, (i:number, group) => {
            let group_id = 'group-'+i;
            let $group = $('<div />').addClass('sb-view-dashboard-group').appendTo($elem);

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

                let $section = $('<div />').attr('id', section_id).addClass('sb-view-dashboard-section mdc-layout-grid').appendTo($group);

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
                    let $row = $('<div />').addClass('sb-view-dashboard-row mdc-layout-grid__inner').appendTo($section);
                    if(row.hasOwnProperty('height')) {
                        // once the view will be ready, update height according to context total height
                        this.getView().isReady().then( () => {
                            let available_height = this.getView().getContext().getContainer().height() - (section.rows.length * 24);
                            let height = Math.floor( (parseInt(row.height, 10) / 100) * available_height );
                            $row.css('height', height + 'px');
                            $row.find('.mdc-layout-grid__cell').css('height', height + 'px');
                        });
                        // do the same when window is resized
                        let timeout: any;
                        $(window).on('resize', () => {
                            clearTimeout(timeout);
                            timeout = setTimeout( () => {
                                let available_height = this.getView().getContext().getContainer().height() - (section.rows.length * 24);
                                let height = Math.floor( (parseInt(row.height, 10) / 100) * available_height );
                                $row.css('height', height + 'px');
                                $row.find('.mdc-layout-grid__cell').css('height', height + 'px');
                            });
                        });
                    }
                    $.each(row.columns, (l:number, column) => {
                        let $column = $('<div />').addClass('mdc-layout-grid__cell').appendTo($row);

                        if(column.hasOwnProperty('width')) {
                            $column.addClass('mdc-layout-grid__cell--span-' + Math.round((parseInt(column.width, 10) / 100) * 12));
                        }

                        let $inner_cell = $('<div />').addClass('mdc-layout-grid__cell').appendTo($column);
                        $column = $('<div />').addClass('mdc-layout-grid__inner').appendTo($inner_cell);

                        $.each(column.items, (i, item) => {
                            let $cell = $('<div />').addClass('mdc-layout-grid__cell').appendTo($column);

                            // try to resolve the cell title
                            let cell_title = (item.hasOwnProperty('label'))?item.label:'';
                            if(item.hasOwnProperty('id')) {
                                cell_title = TranslationService.resolve(translation, 'view', [this.view.getId(), 'layout'], item.id, cell_title);
                            }
                            // append the group title, if any
                            if(cell_title.length) {
                                $cell.append($('<div/>').addClass('sb-view-dashboard-cell-title').text(cell_title));
                            }

                            // compute the width (on a 12 columns grid basis), from 1 to 12
                            let width = (item.hasOwnProperty('width'))?Math.round((parseInt(item.width, 10) / 100) * 12): 12;
                            $cell.addClass('mdc-layout-grid__cell--span-' + width);

                            if(item.hasOwnProperty('entity') && item.hasOwnProperty('view')) {

                                let config = {...item};
                                let view_id = (config.hasOwnProperty('view'))?config.view:'list.default';
                                let parts = view_id.split(".", 2);
                                let view_type = (parts.length > 1)?parts[0]:'list';
                                let view_name = (parts.length > 1)?parts[1]:parts[0];

                                let domain = (config.hasOwnProperty('domain'))?config['domain']:[];

                                config.domain = domain;
                                config.view_type = view_type;
                                config.view_name = view_name;

                                let widget:Widget = new WidgetDashboardItem(this, item.label, '', config);

                                // store widget in widgets Map, using field name as key
                                if(typeof this.model_widgets[0] == 'undefined') {
                                    this.model_widgets[0] = {};
                                }
                                this.model_widgets[0][item.id] = widget;
                                $cell.append(widget.attach());
                            }

                        });
                    });
                });
            });
            UIHelper.decorateTabBar($tabs);
        });

        this.$layout.append($elem);
    }

    protected async feed(objects: any) {
        // nothing to feed : dashboard is read only
        for(let widget_id of Object.keys(this.model_widgets[0])) {
            let widget = this.model_widgets[0][widget_id];

            // widget might be missing (if not visible)
            if(!widget) continue;

            let $parent = this.$layout.find('#'+widget.getId()).parent();
            // $parent.empty().append(widget.render());
            $parent.append(widget.render());
        }
    }

}