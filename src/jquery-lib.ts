import $ from "jquery";
import "jquery-ui";

// always include behavior capabilities to bundle
import "jquery-ui/ui/widgets/draggable";
import "jquery-ui/ui/widgets/droppable";
import "jquery-ui/ui/widgets/resizable";
import "jquery-ui/ui/widgets/sortable";
import "jquery-ui/ui/widgets/selectable";


// additional dependencies widgets have to be added here
import "jquery-ui/ui/widgets/dialog";
import "jquery-ui/ui/widgets/datepicker";

import 'daterangepicker/daterangepicker.js';

import '../datepicker-improved.jquery.js';

import { locale } from "./i18n/jqueryui";

export { $, locale as jqlocale}