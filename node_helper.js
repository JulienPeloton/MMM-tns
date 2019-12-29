/* Magic Mirror
 * Node Helper: MMM-tns
 * MIT Licensed.
 */
var NodeHelper = require("node_helper");
var request = require("request");


module.exports = NodeHelper.create({

    /* Uncomment to get useful debug messages */
    debuglog: function(msg) {
        //console.log("[DEBUG][MMM-tns-helper] " + msg);
    },


    /*
     * Query the https://wis-tns.weizmann.ac.il/search? page and format
     * results for display. Payload must contain:
     *  identifier, headers_used, nrows, date_start, classified_sne
     */
    socketNotificationReceived: function(notification, payload) {
        var helper = this;

        // Enumerate here the different notifications (only one currently)
        if (notification === "tnsQuery") {
            this.debuglog("Received " + JSON.stringify(payload, null, 2));
            var nrows = payload.nrows
            var date_start = payload.date_start
            var classified_sne = payload.classified_sne

            // Main request
            request(`https://wis-tns.weizmann.ac.il/search?page=0&name=&name_like=0&isTNS_AT=all&public=all&unclassified_at=0&classified_sne=${classified_sne}&ra=&decl=&radius=&coords_unit=arcsec&groupid%5B%5D=null&type%5B%5D=null&discoverer=&date_start%5Bdate%5D=${date_start}&date_end%5Bdate%5D=2100-01-01&discovery_mag_min=&discovery_mag_max=&redshift_min=&redshift_max=&spectra_count=&associated_groups%5B%5D=null&display%5Bredshift%5D=1&display%5Bhostname%5D=1&display%5Bhost_redshift%5D=1&display%5Bsource_group_name%5D=1&display%5Bprograms_name%5D=1&display%5BisTNS_AT%5D=1&display%5Bpublic%5D=1&display%5Bspectra_count%5D=1&display%5Bdiscoverymag%5D=1&display%5Bdiscmagfilter%5D=1&display%5Bdiscoverydate%5D=1&display%5Bdiscoverer%5D=1&display%5Bsources%5D=1&display%5Bbibcode%5D=1&num_page=10&edit%5Btype%5D=&edit%5Bobjname%5D=&edit%5Bid%5D=&sort=desc&order=discoverydate&format=csv`, function(err, res, body) {

                // Parse the output body result into JSON object
                let rows = JSON.parse(helper.csvJSON(body, payload.headers_used));

                // Format the JSON object and restrict the number of rows to display
                var arrayForBrowser = helper.flattenResultSets(rows).slice(0, nrows);
                helper.sendSocketNotification("tns_RESULT", {
                    identifier: payload.identifier,
                    rows: arrayForBrowser
                });
            });
        }
    },

    /* Flatten JSON object */
    flattenResultSets: function(results) {
      var ret = []

      for(var key in results)
          if (Array.isArray(results[key]))
              ret = ret.concat(results[key]);
          else
              ret.push(results[key]);

      return ret;
    },

    /* Convert CSV to JSON */
    csvJSON: function(csv, headers_used) {

      var lines=csv.split("\n");

      var result = [];

      // NOTE: If your columns contain commas in their values, you'll need
      // to deal with those before doing the next step
      // (you might convert them to &&& or something, then covert them back later)
      // jsfiddle showing the issue https://jsfiddle.net/
      var headers=lines[0].split(",").map(str => str.slice(1, -1));

      for(var i=1;i<lines.length;i++){

          var obj = {};
          var currentline=lines[i].split(",");

          // Keep only columns in headers_used
          headers_used.forEach(function (h, index) {
            var index_loc = headers.indexOf(h)
            // console.log(h, currentline[index_loc])
            obj[headers[index_loc]] = currentline[index_loc];
          });

          result.push(obj);

      }
      return JSON.stringify(result);
    },
});
