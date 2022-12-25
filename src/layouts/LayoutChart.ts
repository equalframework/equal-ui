import { $ } from "../jquery-lib";
import { UIHelper } from '../material-lib';
import { Widget, WidgetFactory } from "../equal-widgets";
import { Layout } from './Layout';
import { TranslationService, ApiService, EnvService } from "../equal-services";
import { Domain, Clause, Condition, Reference } from "../Domain";
import { DateReference } from "../equal-lib";
import Chart from 'chart.js/auto';


export class LayoutChart extends Layout {
    private config:any = {};
    private parsed_datasets: any = {};

    public async init() {
        console.debug('LayoutChart::init');
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
        console.debug('LayoutChart::refresh');

        // also re-generate the layout
        if(full) {
            this.$layout.empty();
            this.layout();
        }

        // feed layout with current Model
        let objects = await this.view.getModel().get();
        this.feed(objects);
    }

    /**
     *
     * This method also stores the list of instantiated widgets to allow switching from view mode to edit mode  (for a form or a cell)
     *
     */
    protected async layout() {
        console.debug('LayoutChart::layout');

        let view_schema = this.view.getViewSchema();
        let layout = view_schema.layout;

        this.config = {
            type: 'bar',
            stacked: false,
            group_by: 'range',
            field: 'created',
            range_interval: 'month',
            range_from: 'date.this.year.first',
            range_to: 'date.this.year.last',
            ...layout
        }

        // parse schema to get the operations (datasets), relative dates : range_from, range_to
        this.parsed_datasets = layout.datasets.map( (a:any, index: number) => {
            let dataset:any = {
                label: 'label',
                operation: ['COUNT', 'object.id'],
                ...a
            };

            if(a.hasOwnProperty('domain')) {
                let tmpDomain = new Domain(a.domain);
                let user = this.view.getUser();
                dataset.domain = tmpDomain.parse({}, user).toArray();
            }
            return dataset;
        });

    }

    protected async feed(objects: any) {

        // #todo : split between layout and feed

        this.$layout.empty();

        // display the first object from the collection
        let view_schema = this.view.getViewSchema();
        let layout = view_schema.layout;

        let result:any;

        try {
            result = await ApiService.fetch('/', {
                    get: 'core_model_chart',
                    type: this.config.type,
                    entity: this.config.entity,
                    group_by: this.config.group_by,
                    field: this.config.field,
                    range_interval: this.config.range_interval,
                    range_from: (new DateReference(this.config.range_from)).getDate().toISOString(),
                    range_to: (new DateReference(this.config.range_to)).getDate().toISOString(),
                    datasets: this.parsed_datasets,
                    mode: this.view.getMode(),
                    ...this.view.getParams()
                });
        }
        catch(response) {
            console.warn(response);
            return;
        }


        let $elem: JQuery;

        if(this.view.getMode() == 'grid') {
            $elem = $('<div/>').addClass('table-wrapper').css({"width": "100%"});
            let $container = $('<div/>').css({"width": "100%"}).appendTo($elem);

            let $table = $('<table/>').css({"width": "100%"}).appendTo($container);

            let $thead = $('<thead/>').appendTo($table);
            let $tbody = $('<tbody/>').appendTo($table);

            let object = result[0];

            let $hrow = $('<tr/>').appendTo($thead);
            let i = 0;
            let keys = Object.keys(object).sort();
            for(let field of keys) {
                let $cell = $('<th/>').append(field).appendTo($hrow);
                if(i == 0) {
                    $cell.css({width: "20%"});
                }
                ++i;
            }
            for(let object of result) {
                let $row = $('<tr/>').appendTo($tbody);
                for(let field of keys) {
                    $('<td/>').attr('title', object[field]).append(object[field]).appendTo($row);
                }
            }

            UIHelper.decorateTable($elem);
        }
        else {
            $elem = $('<canvas/>').css({"width": "100%", "height": "calc(100% - 20px)", "margin-top": "20px"});

            const CHART_COLORS = [
                'rgb(75, 192, 192)',    // green
                'rgb(255, 99, 132)',    // red
                'rgb(54, 162, 235)',    // blue
                'rgb(255, 159, 64)',    // orange
                'rgb(153, 102, 255)',   // purple
                'rgb(255, 205, 86)',    // yellow
                'rgb(201, 203, 207)',   // grey
                'rgb(203, 101, 207)',   // violet
                'rgb(153, 102, 255)',   // pink
                'rgb(153, 102, 255)'    // darkgreen
            ];

            let datasets: any, options: any;

            if(['pie', 'doughnut', 'polarArea'].indexOf(this.config.type) >= 0) {
                datasets = result.datasets.map( (a:any, index: number) => { return {label: layout.datasets[index].label, data: a, backgroundColor: CHART_COLORS}; });
                options = {
                    responsive: true,
                    maintainAspectRatio: false
                };
            }
            else {
                datasets = result.datasets.map( (a:any, index: number) => { return {label: layout.datasets[index].label, data: a, backgroundColor: CHART_COLORS[index%10]}; });
                options = {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            stacked: this.config.stacked
                        },
                        y: {
                            beginAtZero: true,
                            stacked: this.config.stacked
                        }
                    }
                };
            }

            this.getView().isReady().then( () => {
                const myChart = new Chart(<any> $elem[0], {
                    type: this.config.type,
                        data: {
                            labels: result.labels,
                            datasets: datasets
                        },
                        options: options
                });
            });
        }

        this.$layout.append($elem);

    }

}