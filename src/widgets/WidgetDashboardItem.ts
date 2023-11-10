import Widget from "./Widget";
import { View, Layout } from "../equal-lib";
import { Domain, Clause, Condition } from "../Domain";
import { UIHelper } from '../material-lib';

import { ApiService, TranslationService } from "../equal-services";

export class WidgetDashboardItem extends Widget {

    constructor(layout:Layout, label: string, value: any, config: any) {
        super(layout, 'dashboarditem', label, value, config);
    }

    public render():JQuery {

        this.$elem = $('<div />');

        let view = new View(this.getLayout().getView().getContext(), this.config.entity, this.config.view_type, this.config.view_name, this.config.domain, this.mode, 'widget', this.getLayout().getView().getLang(), this.config);

        view.isReady().then( () => {
            let $container = view.getContainer();
            // inject View in parent Context object
            this.$elem.append($container);
        });

        this.$elem.addClass('sb-widget').attr('id', this.getId()).css('height', '100%');

        return this.$elem;
    }

}