import { $ } from "../jquery-lib";
import { UIHelper } from '../material-lib';
import { Widget, WidgetFactory } from "../equal-widgets";
import { Layout } from './Layout';
import { TranslationService, ApiService, EnvService } from "../equal-services";
import { Domain, Clause, Condition, Reference } from "../Domain";
import { DateReference } from "../equal-lib";
import Chart from 'chart.js/auto';


export class LayoutChart extends Layout {

    public async init() {
        console.log('LayoutChart::init');
        try {
            // initialize the layout
            this.layout();
        }
        catch(err) {
            console.log('Something went wrong ', err);
        }
    }

    // refresh layout
    // this method is called in response to parent View `onchangeModel` method
    public async refresh(full: boolean = false) {
        console.log('LayoutChart::refresh');

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
     * This method also stores the list of instanciated widgets to allow switching from view mode to edit mode  (for a form or a cell)
     *
     */
    protected async layout() {
        console.log('LayoutChart::layout');

        let view_schema = this.view.getViewSchema();
    
        let layout = view_schema.layout;

        let config = {
            type: 'bar',
            stacked: false,
            group_by: 'range',
            field: 'created',            
            range_interval: 'month',
            range_from: 'date.this.year.first',
            range_to: 'date.this.year.last',
            ...layout
        }

/*
// parse schema to get the operations (datasets), relative dates : range_from, range_tp
*/
        let $elem = $('<canvas/>').css({"width": "100%", "height": "100%"});
        this.$layout.append($elem);

//    http://equal.local/?get=model_chart&entity=lodging\sale\booking\Booking&range_from=2022-03-01&range_to=2022-06-30&datasets=[{operation:[%22+%22,%20%22object.total_paid%22]}]
        const result = await ApiService.fetch('/', {
            get: 'model_chart',
            type: config.type,
            entity: config.entity,
            group_by: config.group_by,
            field: config.field,
            range_interval: config.range_interval,
            range_from: (new DateReference(config.range_from)).getDate().toISOString(),
            range_to: (new DateReference(config.range_to)).getDate().toISOString(),
            datasets: layout.datasets
        });

        const CHART_COLORS = [
            'rgb(75, 192, 192)',    // green
            'rgb(255, 99, 132)',    // red
            'rgb(54, 162, 235)',    // blue
            'rgb(255, 159, 64)',    // orange
            'rgb(153, 102, 255)',   // purple
            'rgb(255, 205, 86)',    // yellow
            'rgb(201, 203, 207)'    // grey
        ];

        let datasets: any, options: any;
        
        if(['pie', 'doughnut', 'polarArea'].indexOf(config.type) >= 0) {
            datasets = result.datasets.map( (a:any, index: number) => { return {label: layout.datasets[index].label, data: a, backgroundColor: CHART_COLORS}; });
            options = {
                responsive: true,
                maintainAspectRatio: false
            };
        }
        else {
            datasets = result.datasets.map( (a:any, index: number) => { return {label: layout.datasets[index].label, data: a, backgroundColor: CHART_COLORS[index%7]}; });
            options = {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: config.stacked
                    },
                    y: {
                        beginAtZero: true,
                        stacked: config.stacked
                    }
                }
            };
        }         

        this.getView().isReady().then( () => {
            const myChart = new Chart(<any> $elem[0], {
                type: config.type,
                    data: {
                        labels: result.labels,
                        datasets: datasets
                    },
                    options: options
            });
        });

    }

    protected feed(objects: any) {
        console.log('LayoutChart::feed', objects);
        // display the first object from the collection


    }

}