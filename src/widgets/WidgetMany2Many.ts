import Widget from "./Widget";
import { View, Layout } from "../equal-lib";
import { Domain, Clause, Condition } from "../Domain";
import { UIHelper } from '../material-lib';

import { ApiService, TranslationService } from "../equal-services";

export default class WidgetMany2Many extends Widget {

    protected rel_type: string;

    constructor(layout:Layout, label: string, value: any, config: any) {
        super(layout, 'many2many', label, value, config);
        this.rel_type = 'many2many';
    }

    public render():JQuery {
        this.$elem = $('<div />');

        // make sure view is not instantiated during 'layout' phase (while config is still incomplete)
        if(this.config.hasOwnProperty('ready') && this.config.ready) {
            // assign config by copy
            let view_config = {...this.config};

            // allow the widget to force edit capabilities even when parent context is set to 'view' mode
            if(this.config.hasOwnProperty('mode') && ['view', 'edit'].indexOf(this.config.mode) >= 0) {
                this.mode = this.config.mode;
            }

            // if items are not selectable
            if (this.config.header?.hasOwnProperty('selection') && !this.config.header.selection) {
                view_config = {
                    ...this.config,
                    ...{
                        header: {
                            selection: false
                        },
                        selection_actions: []
                    }
                };
            }
            // if default is voided in the header, do not show the remove button
            else if (this.config.hasOwnProperty('header')
                && this.config.header.hasOwnProperty('selection')
                && this.config.header.selection.hasOwnProperty('default')
                && !this.config.header.selection.default
            ) {
                let selection_actions: any = [];
                if(this.config.header.selection.hasOwnProperty('actions')) {
                    // #memo - voiding defaults does not prevent custom actions
                    selection_actions = this.config.header.selection.actions;
                    // if actions target known default actions, use them
                }
                view_config = {
                    ...this.config,
                    ...{
                        header: {
                            selection: {
                                default: false,
                                actions: selection_actions
                            }
                        },
                        // selection_actions: selection_actions
                    }
                };
            }
            // in all other situations (default for widget), there is only the remove button
            else {
                // merge config and set a single 'remove' selection action
                view_config = {
                    ...this.config,
                    ...{
                        header: {
                            selection: {
                                default: false
                            }
                        },
                        // update the actions of the "current selection" button
                        selection_actions: [
                            {
                                label: 'SB_ACTIONS_BUTTON_REMOVE',
                                icon: 'playlist_remove',
                                handler: (selection:any) => {
                                    for(let id of selection) {
                                        let index = this.value.indexOf(id);
                                        if( index > -1 ) {
                                            this.value.splice(index, 1);
                                        }
                                        index = this.value.indexOf(-id);
                                        if( index > -1 ) {
                                            this.value.splice(index, 1);
                                        }
                                        this.value.push(-id);
                                    }
                                    this.$elem.trigger('_updatedWidget');
                                }
                            }
                        ]
                    }
                };
            }

            let domain: Domain = new Domain(this.config.domain);

            // add join condition for limiting list to the current object
            // this is only valid on the first rendering, afterward the layout controls the ids
            if(['one2many', 'many2many'].indexOf(this.config.type) > -1 && this.config.hasOwnProperty('foreign_field')) {
                if(this.config.type == 'one2many') {
                    domain.merge(new Domain([this.config.foreign_field, '=', this.config.object_id]));
                }
                else {
                    domain.merge(new Domain([this.config.foreign_field, 'contains', this.config.object_id]));
                }
            }

            // domain is updated based on user actions: an additional clause for + (accept these whatever the other conditions) and additional conditions for - (prevent these whatever the other conditions)
            if(this.config.hasOwnProperty('ids_to_add') && this.config.ids_to_add.length) {
                domain.addClause(new Clause([new Condition("id", "in", this.config.ids_to_add)]));
            }
            if(this.config.hasOwnProperty('ids_to_del') && this.config.ids_to_del.length) {
                domain.addCondition(new Condition("id", "not in", this.config.ids_to_del));
            }

            let view = new View(this.getLayout().getView().getContext(), this.config.entity, this.config.view_type, this.config.view_name, domain.toArray(), this.mode, 'widget', this.config.lang, view_config);

            this.$elem.append($('<div/>').addClass('sb-view-loader-overlay').append($('<div/>').addClass('loader-container').append($('<div/>').addClass('loader-spinner'))));

            view.isReady().then( () => {
                let $container = view.getContainer();

                // default values
                let has_action_select: boolean = (this.rel_type == 'many2many');
                let has_action_create: boolean = true;

                // override with view schema
                if(this.config.header?.hasOwnProperty('actions')) {
                    // #memo - adding `select` for a one2many is generally meaningless, since a child can only be linked to a single parent
                    if(this.config.header.actions?.hasOwnProperty('ACTION.SELECT')) {
                        has_action_select = (this.config.header.actions['ACTION.SELECT']) ? true : false;
                    }
                    if(this.config.header.actions?.hasOwnProperty('ACTION.CREATE')) {
                        const actionCreate = this.config.header.actions['ACTION.CREATE'];
                        if (Array.isArray(actionCreate)) {
                            has_action_create = actionCreate.length > 0;
                        }
                        else {
                            has_action_create = Boolean(actionCreate);
                        }
                    }
                }

                let $actions_set = $container.find('.sb-view-header-actions-std');

                if(this.mode == 'edit') {
                    // #todo - selection/update only available in edit mode ?
                    if(has_action_select) {
                        let domain: any[] = (new Domain(this.config.domain)).toArray();

                        if(this.config.header?.actions?.hasOwnProperty('ACTION.SELECT')) {
                            if( Array.isArray(this.config.header.actions['ACTION.SELECT']) ) {
                                let item = this.config.header.actions['ACTION.SELECT'][0];
                                if(item.hasOwnProperty('domain')) {
                                    let tmpDomain = new Domain(domain);
                                    tmpDomain.merge(new Domain(item.domain));
                                    domain = tmpDomain.toArray();
                                }
                            }
                        }

                        let button_label = TranslationService.instant((this.rel_type == 'many2many') ? 'SB_ACTIONS_BUTTON_ADD' : 'SB_ACTIONS_BUTTON_SELECT');
                        $actions_set.append(
                                UIHelper.createButton(this.getId()+'_action-edit', button_label, 'raised')
                                .on('click', async () => {
                                    let purpose = (this.rel_type == 'many2many') ? 'add' : 'select';

                                    // request a new Context for selecting an existing object to add to current selection
                                    this.getLayout().openContext({
                                        entity: this.config.entity,
                                        type: 'list',
                                        name: 'default',
                                        domain: domain,
                                        mode: 'view',
                                        purpose: purpose,
                                        callback: (data:any) => {
                                            if(data && data.selection) {
                                                // add ids that are not yet in the Object value
                                                for(let id of data.selection) {
                                                    let index = this.value.indexOf(id);
                                                    if( index > -1 ) {
                                                        this.value.splice(index, 1);
                                                    }
                                                    index = this.value.indexOf(-id);
                                                    if( index > -1 ) {
                                                        this.value.splice(index, 1);
                                                    }
                                                    this.value.push(id);
                                                }
                                                this.$elem.trigger('_updatedWidget');
                                            }
                                        }
                                    });
                                })
                            );
                    }

                }

                // #memo - creation can be performed in view mode as well as in edit mode
                if(has_action_create) {
                    // generate domain for object creation
                    let domain: any[];
                    let tmpDomain = new Domain(this.config.domain);
                    tmpDomain.merge(new Domain([this.config.foreign_field, '=', this.config.object_id]));
                    domain = tmpDomain.toArray();

                    $actions_set.append(
                            UIHelper.createButton(this.getId()+'_action-create', TranslationService.instant('SB_ACTIONS_BUTTON_CREATE'), 'raised')
                            .on('click', async () => {
                                let view_type = 'form';
                                let view_name = view.getName();
                                let custom_actions: any;

                                if(this.config.header?.actions?.hasOwnProperty('ACTION.CREATE') && Array.isArray(this.config.header.actions['ACTION.CREATE'])) {
                                    custom_actions = this.config.header.actions
                                }
                                else {
                                    custom_actions = view.getCustomActions();
                                }

                                if(custom_actions.hasOwnProperty('ACTION.CREATE')) {
                                    if(Array.isArray(custom_actions['ACTION.CREATE']) && custom_actions['ACTION.CREATE'].length) {
                                        let custom_action_create = custom_actions['ACTION.CREATE'][0];
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

                                // request a new Context for selecting an existing object to add to current selection
                                this.getLayout().openContext({
                                    entity: this.config.entity,
                                    type: view_type,
                                    name: view_name,
                                    domain: domain,
                                    mode: 'edit',
                                    purpose: 'create',
                                    callback: (data:any) => {
                                        if(data && data.selection) {
                                            if(data.selection.length) {
                                                for(let id of data.selection) {
                                                    this.value.push(id);
                                                }
                                                this.$elem.trigger('_updatedWidget');
                                            }
                                        }
                                    }
                                });
                            })
                        );
                }

                // inject View in parent Context object
                this.$elem.empty().append($container);
            });

        }

        return this.$elem.addClass('sb-widget').attr('id', this.getId()).attr('data-type', this.config.type).attr('data-usage', this.config.usage||'');
    }

}