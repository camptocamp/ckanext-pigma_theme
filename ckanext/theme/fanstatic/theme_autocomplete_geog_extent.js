/* An auto-complete module for select and input elements that can pull in
 * a list of terms from an API endpoint (provided using data-module-source).
 * based on autocomplete module
 *
 * source   - A url pointing to an API autocomplete endpoint.
 * interval - The interval between requests in milliseconds (default: 1000).
 * items    - The max number of items to display (default: 10)
 * key      - A string of the key you want to be the form value to end up on
 *            from the ajax returned results
 * label    - A string of the label you want to appear within the dropdown for
 *            returned results
 *
 * Examples
 *
 *   // <input name="geoextent" data-module="theme_autocomplete_geog_extent" data-module-source="http://" />
 *
 */
this.ckan.module('theme_autocomplete_geog_extent', function (jQuery) {
  return {
    /* Options for the module */
    options: {
      key: false,
      label: false,
      items: 10,
      source: null,
      geoextentService: null,
      interval: 300,
      dropdownClass: '',
      containerClass: ''
    },

    /* Sets up the module, binding methods, creating elements etc. Called
     * internally by ckan.module.initialize();
     *
     * Returns nothing.
     */
    initialize: function () {
      jQuery.proxyAll(this, /_on/, /format/);
      this.setupAutoComplete();
    },

    /* Sets up the auto complete plugin.
     *
     * Returns nothing.
     */
    setupAutoComplete: function () {
      var settings = {
        width: 'resolve',
        formatResult: this.formatResult,
        formatNoMatches: this.formatNoMatches,
        formatInputTooShort: this.formatInputTooShort,
        dropdownCssClass: this.options.dropdownClass,
        containerCssClass: this.options.containerClass
      };

      if (!this.el.is('select')) {
        settings.query = this._onQuery;
        settings.createSearchChoice = this.formatTerm;
        settings.initSelection = this.formatInitialValue;
      }
      else {
        if (/MSIE (\d+\.\d+);/.test(navigator.userAgent)) {
            var ieversion=new Number(RegExp.$1);
            if (ieversion<=7) {return}
         }
      }

      var select2 = this.el.select2(settings).data('select2');

      // This prevents Internet Explorer from causing a window.onbeforeunload
      // even from firing unnecessarily
      $('.select2-choice', select2.container).on('click', function() {
        return false;
      });

      var geoextentService = this.options.geoextentService;
      var sandbox = this.sandbox

      this.el.on('select2-selecting', function(e) {
        // Set the text value on second input element
        var text = e.choice['text'];
        var id = e.choice['id'];
        $('input[name="spatial-text"]').val(id);
        // trick to get the text value on this input, while retrieving the id for next input (see line above)
        e.choice['id'] = text
        //Retrieve and set the extent value on the geojson field
        var data = {};
        data['id'] = id;
        if (geoextentService != null) {
            $.get(
                 sandbox.client.url(geoextentService),
                 data,
                 function(responseText) {
                       $('textarea[name="spatial"]').val(responseText);
                 }
            ).fail( function() {
                $('textarea[name="spatial"]').val('{}');
                sandbox.notify('Unable to get geojson extent from API', 'error');
            });
        }
      });
      this._select2 = select2;
    },

    /* Looks up the completions for the current search term and passes them
     * into the provided callback function.
     *
     * The results are formatted for use in the select2 autocomplete plugin.
     *
     * string - The term to search for.
     * fn     - A callback function.
     *
     * Examples
     *
     *   module.getCompletions('cake', function (results) {
     *     results === {results: []}
     *   });
     *
     * Returns a jqXHR promise.
     */
    getCompletions: function (string, fn) {
      var parts  = this.options.source.split('?');
      var end    = parts.pop();
      var source = parts.join('?') + encodeURIComponent(string) + end;
      var client = this.sandbox.client;
      var options = {
        format: function(data) {
          var completion_options = jQuery.extend(options, {objects: true});
          return {
            results: client.parseCompletions(data, completion_options)
          }
        },
        key: this.options.key,
        label: this.options.label
      };

      return client.getCompletions(source, options, fn);
    },

    /* Looks up the completions for the provided text but also provides a few
     * optimisations. If there is no search term it will automatically set
     * an empty array. Ajax requests will also be debounced to ensure that
     * the server is not overloaded.
     *
     * string - The term to search for.
     * fn     - A callback function.
     *
     * Returns nothing.
     */
    lookup: function (string, fn) {
      var module = this;

      // Cache the last searched term otherwise we'll end up searching for
      // old data.
      this._lastTerm = string;

      // Kills previous timeout
      clearTimeout(this._debounced);

      // OK, wipe the dropdown before we start ajaxing the completions
      fn({results:[]});

      if (string) {
        // Set a timer to prevent the search lookup occurring too often.
        this._debounced = setTimeout(function () {
          var term = module._lastTerm;

          // Cancel the previous request if it hasn't yet completed.
          if (module._last && typeof module._last.abort == 'function') {
            module._last.abort();
          }

          module._last = module.getCompletions(term, fn);
        }, this.options.interval);

        // This forces the ajax throbber to appear, because we've called the
        // callback already and that hides the throbber
        $('.select2-search input', this._select2.dropdown).addClass('select2-active');
      }
    },

    /* Formatter for the select2 plugin that returns a string for use in the
     * results list with the current term emboldened.
     *
     * state     - The current object that is being rendered.
     * container - The element the content will be added to (added in 3.0)
     * query     - The query object (added in select2 3.0).
     *
     *
     * Returns a text string.
     */
    formatResult: function (state, container, query) {
      var term = this._lastTerm || null; // same as query.term

      if (container) {
        // Append the select id to the element for styling.
        container.attr('data-value', state.id);
      }

      return state.text.split(term).join(term && term.bold());
    },

    /* Formatter for the select2 plugin that returns a string used when
     * the filter has no matches.
     *
     * Returns a text string.
     */
    formatNoMatches: function (term) {
      return !term ? this._('Start typing…') : this._('No matches found');
    },

    /* Formatter used by the select2 plugin that returns a string when the
     * input is too short.
     *
     * Returns a string.
     */
    formatInputTooShort: function (term, min) {
      return this.ngettext(
        'Input is too short, must be at least one character',
        'Input is too short, must be at least %(num)d characters',
        min
      );
    },

    /* Takes a string and converts it into an object used by the select2 plugin.
     *
     * term - The term to convert.
     *
     * Returns an object for use in select2.
     */
    formatTerm: function (term) {
      term = jQuery.trim(term || '');

      // Need to replace comma with a unicode character to trick the plugin
      // as it won't split this into multiple items.
      return {id: term.replace(/,/g, '\u002C'), text: term};
    },

    /* Callback function that parses the initial field value.
     *
     * element  - The initialized input element wrapped in jQuery.
     * callback - A callback to run once the formatting is complete.
     *
     * Returns a term object or an array depending on the type.
     */
    formatInitialValue: function (element, callback) {
      var value = jQuery.trim(element.val() || '');
      var formatted;
      formatted = this.formatTerm(value);

      // Select2 v3.0 supports a callback for async calls.
      if (typeof callback === 'function') {
        callback(formatted);
      }

      return formatted;
    },

    /* Callback triggered when the select2 plugin needs to make a request.
     *
     * Returns nothing.
     */
    _onQuery: function (options) {
      if (options) {
        this.lookup(options.term, options.callback);
      }
    },

    /* Called when a key is pressed.  If the key is a comma we block it and
     * then simulate pressing return.
     *
     * Returns nothing.
     */
    _onKeydown: function (event) {
      if (typeof event.key !== 'undefined' ? event.key === ',' : event.which === 188) {
        event.preventDefault();
        setTimeout(function () {
          var e = jQuery.Event("keydown", { which: 13 });
          jQuery(event.target).trigger(e);
        }, 10);
      }
    }
  };
});
