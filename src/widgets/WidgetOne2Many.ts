import WidgetMany2Many from "./WidgetMany2Many";
import Layout from "../layouts/Layout";
import { Domain, Clause, Condition } from "../Domain";

import { ApiService } from "../equal-services";



export default class WidgetOne2Many extends WidgetMany2Many {


    constructor(layout: Layout, label: string, value: any, config: any) {
        super(layout, label, value, config);
        this.rel_type = 'one2many';
    }

    public render(): JQuery {
        if(this.config.hasOwnProperty('mode') && ['view', 'edit'].indexOf(this.config.mode) >= 0) {
            this.mode = this.config.mode;
        }

        if(this.mode !== 'view' || this.config.layout !== 'list') {
            return super.render();
        }

        const $elem = $('<div/>')
            .css({
                'display': 'flex',
                'flex-wrap': 'wrap',
                'gap': '4px',
                'min-height': '20px'
            })
            .append($('<span/>').text('...'));

        this.$elem = $elem;
        this.loadObjects().then((objects: any[]) => {
            $elem.empty();

            for(const object of objects) {
                const name = (typeof object?.name === 'string' && object.name.trim().length)
                    ? object.name
                    : String(object?.id ?? '');
                const $item = $('<span/>')
                    .addClass('sb-widget-one2many-item')
                    .css({'display': 'inline-block'})
                    .text(name);

                this.applyStyling($item, this.resolveStyles(object));
                $elem.append($item);
            }
        }).catch((response: any) => {
            console.warn('WidgetOne2Many::render - unable to load related objects', response);
        });

        return this.$elem
            .addClass('sb-widget')
            .addClass('sb-widget-type-one2many')
            .addClass('sb-widget-mode-' + this.mode)
            .attr('id', this.getId())
            .attr('data-type', this.config.type)
            .attr('data-field', this.config.field)
            .attr('data-usage', this.config.usage || '');
    }

    private async loadObjects(): Promise<any[]> {
        const domain = new Domain(this.config.domain ?? []);

        if(this.config.foreign_field && this.config.object_id) {
            domain.merge(new Domain([
                this.config.foreign_field,
                '=',
                this.config.object_id
            ]));
        }

        if(Array.isArray(this.config.ids_to_add) && this.config.ids_to_add.length) {
            domain.addClause(new Clause([
                new Condition('id', 'in', this.config.ids_to_add)
            ]));
        }
        if(Array.isArray(this.config.ids_to_del) && this.config.ids_to_del.length) {
            domain.addCondition(new Condition('id', 'not in', this.config.ids_to_del));
        }

        const objects = await ApiService.collect(
            this.config.entity,
            domain.toArray(),
            this.getFieldsProjection(),
            this.config.order ?? 'id',
            this.config.sort ?? 'asc',
            0,
            this.config.limit ?? 25,
            this.config.lang ?? '',
            this.config.controller ?? 'model_collect'
        );
        return Array.isArray(objects) ? objects : [];
    }

    private getFieldsProjection(): string[] {
        const fields = new Set<string>(['id', 'name']);
        const styleSets = Array.isArray(this.config.styles) ? this.config.styles : [];

        for(const styleSet of styleSets) {
            if(!styleSet || typeof styleSet !== 'object' || !Array.isArray(styleSet.visible)) {
                continue;
            }
            const domain = new Domain(styleSet.visible);
            for(const clause of domain.getClauses()) {
                for(const condition of clause.getConditions()) {
                    const operand = condition.getOperand();
                    const value = condition.getValue();
                    const operandField = this.getObjectField(operand);
                    const valueField = this.getObjectField(value);
                    const hasReference = this.isReference(operand) || this.isReference(value);

                    if(operandField) {
                        fields.add(operandField);
                    }
                    if(valueField) {
                        fields.add(valueField);
                    }
                    // Also support the usual [field, operator, value] notation.
                    if(!hasReference && typeof operand === 'string') {
                        fields.add(operand);
                    }
                }
            }
        }

        return Array.from(fields);
    }

    private getObjectField(value: any): string | null {
        if(typeof value !== 'string' || value.indexOf('object.') !== 0) {
            return null;
        }
        const field = value.substring('object.'.length);
        return field.length ? field : null;
    }

    private isReference(value: any): boolean {
        return typeof value === 'string'
            && ['object.', 'user.', 'parent.', 'env.', 'date.'].some((prefix: string) => value.indexOf(prefix) === 0);
    }

    private resolveStyles(object: any): any {
        if(!Array.isArray(this.config.styles)) {
            return this.config.styles ?? {};
        }

        let styles: any = {};
        const user = this.getLayout().getUser();
        const parent = this.config.object ?? {};
        const env = this.getLayout().getEnv();

        for(const styleSet of this.config.styles) {
            if(!styleSet || typeof styleSet !== 'object') {
                continue;
            }
            let visible = true;

            if(typeof styleSet.visible === 'boolean') {
                visible = styleSet.visible;
            }
            else if(Array.isArray(styleSet.visible)) {
                visible = new Domain(styleSet.visible).evaluate(object, user, parent, env);
            }

            if(visible) {
                styles = {...styles, ...(styleSet.apply ?? {})};
            }
        }

        return styles;
    }

}
