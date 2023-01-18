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

            console.log('### m2m', view_config);
            if(!this.config.hasOwnProperty('header') || !this.config.header.hasOwnProperty('selection') || !this.config.header.selection.hasOwnProperty('default') || this.config.header.selection.default) {
                console.log('### adding remove');
                view_config = {
                    ...this.config,
                    ...{
                        show_actions: true,
                        // update the actions of the "current selection" button
                        selection_actions: [
                            {
                                label: 'SB_ACTIONS_BUTTON_REMOVE',
                                icon:  'delete',
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
            else {
                console.log('### skipping remove');
                view_config = {
                    ...this.config,
                    ...{
                        show_actions: false,
                        selection_actions: []
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

            view.isReady().then( () => {
                let $container = view.getContainer();

                if(this.mode == 'edit') {

                    // default values
                    let has_action_select = (this.rel_type == 'many2many');
                    let has_action_create = true;

                    // override with view schema
                    if(this.config.hasOwnProperty('header') && this.config.header.hasOwnProperty('actions')) {
                        if(this.config.header.actions.hasOwnProperty('ACTION.SELECT')) {
                            has_action_select = (this.config.header.actions['ACTION.SELECT'])?true:false;
                        }
                        if(this.config.header.actions.hasOwnProperty('ACTION.CREATE')) {
                            has_action_create = (this.config.header.actions['ACTION.CREATE'])?true:false;
                        }
                    }

                    let $actions_set = $container.find('.sb-view-header-actions-std');

                    if(has_action_select) {
                        let domain: any[] = this.config.domain;

                        if(this.config.hasOwnProperty('header') && this.config.header.hasOwnProperty('actions') && this.config.header.actions.hasOwnProperty('ACTION.SELECT')) {
                            if( Array.isArray(this.config.header.actions['ACTION.SELECT']) ) {
                                let item = this.config.header.actions['ACTION.SELECT'][0];
                                if(item.hasOwnProperty('domain')) {
                                    let tmpDomain = new Domain(domain);
                                    tmpDomain.merge(new Domain(item.domain));
                                    domain = tmpDomain.toArray();
                                }
                            }
                        }

                        let button_label = TranslationService.instant((this.rel_type == 'many2many')?'SB_ACTIONS_BUTTON_ADD':'SB_ACTIONS_BUTTON_SELECT');
                        $actions_set
                        .append(
                            UIHelper.createButton(this.getId()+'_action-edit', button_label, 'raised')
                            .on('click', async () => {
                                let purpose = (this.rel_type == 'many2many')?'add':'select';

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

                    if(has_action_create) {
                        // generate domain for object creation

                        let domain: any[] = this.config.domain;
                        let tmpDomain = new Domain(domain);
                        tmpDomain.merge(new Domain([this.config.foreign_field, '=', this.config.object_id]));
                        domain = tmpDomain.toArray();

                        $actions_set
                        .append(
                            UIHelper.createButton(this.getId()+'_action-create', TranslationService.instant('SB_ACTIONS_BUTTON_CREATE'), 'raised')
                            .on('click', async () => {
                                let view_type = 'form';
                                let view_name = view.getName();
                                let custom_actions = view.getCustomActions();
                                if(custom_actions.hasOwnProperty('ACTION.CREATE')) {
                                    if(Array.isArray(custom_actions['ACTION.CREATE']) && custom_actions['ACTION.CREATE'].length) {
                                        let custom_action_create = custom_actions['ACTION.CREATE'][0];
                                        if(custom_action_create.hasOwnProperty('view')) {
                                            let parts = custom_action_create.view.split('.');
                                            if(parts.length) view_type = <string>parts.shift();
                                            if(parts.length) view_name = <string>parts.shift();
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
                }

                // inject View in parent Context object
                this.$elem.append($container);
            });

        }

        this.$elem.addClass('sb-widget').attr('id', this.getId());

        return this.$elem;
    }

}