/* Magic Mirror
 * Module: MMM-tns
 * MIT Licensed.
 *
 * See README.md for details on this.
 */
Module.register("MMM-tns", {

    // Uncomment to get useful debug comments.
    debuglog: function(msg) {
      //console.log("[DEBUG][MMM-tns-main] " + msg);
    },

    getStyles: function() {
        return [ "MMM-tns.css" ];
    },


    getDom: function() {
        this.topDiv = this.createEle(null, "div", "tnsQuery");

        // Header
        var header = document.createElement("header");
        header.classList.add("xsmall", "bright", "header");
        header.innerHTML = this.config.header;
        this.topDiv.appendChild(header);

        // Table
        var table = this.createEle(this.topDiv, "table");
        var thead = this.createEle(table, "thead");
        var tr = this.createEle(thead, "tr");
        var helper = this;
        this.config.columns.forEach(function(col) {
            helper.createEle(tr, "th", null, col.title || col.name);
        });
        this.tbody = this.createEle(table, "tbody");

        return this.topDiv;
    },

    // Helper function to ease element creation
    createEle: function(parentEle, eleType, name, innerHtml) {
        var div = document.createElement(eleType);
        if (name) {
            div.className = name;
        }
        if (innerHtml) {
            div.innerHTML = innerHtml;
        }
        if (parentEle) {
            parentEle.appendChild(div);
        }
        return div;
    },

    // What to do when MM receives notification
    notificationReceived: function(notification, payload, sender) {
        switch(notification) {
        case "DOM_OBJECTS_CREATED":
            this.debuglog("Received notification " + notification + ", payload=" + payload + ", from " + sender);
            this.triggerHelper();
            this.startTimer();
            break;
        }
    },

    // Trigger the query to the website (see node_helper.js)
    triggerHelper: function() {
        this.debuglog("Sending tns id=" + this.identifier + ", query=" + this.config.query);
        this.sendSocketNotification("tnsQuery", {
            identifier: this.identifier,
            headers_used: this.config.columns.map(row => row.name),
            nrows:      this.config.nrows,
            date_start: this.config.date_start,
            classified_sne: this.config.classified_sne
        });
    },

    // Timer starter
    startTimer: function() {
        var self = this;
        if (! this.timer) {
            this.debuglog("Start timer");
            this.timer = setInterval(
                function() { self.triggerHelper(); },
                self.config.intervalSeconds * 1000
            );
        }
    },

    // What to do when notification from the module is received
    socketNotificationReceived: function(notification, payload) {
        if (payload.identifier === this.identifier) {
            switch(notification) {
            case "tns_RESULT":
                this.replaceTableRows(this.tbody, payload.rows);
                break;
            }
        }
    },

    // Update the table with new results from the website query
    replaceTableRows: function(parent, rowsToAdd) {
        this.debuglog("Replacing table with new server results:");
        var helper = this;
        while (parent.firstChild) parent.removeChild(parent.firstChild);
        if (rowsToAdd && rowsToAdd.length) {

            rowsToAdd.forEach(function(dbRow) {
                helper.debuglog("   Adding row to table: " + JSON.stringify(dbRow, null, 2));
                var tr = helper.createEle(parent, "tr");
                var ra = helper.convertRADEC(dbRow['RA']);
                var dec = helper.convertRADEC(dbRow['DEC']);
                helper.config.columns.forEach(function(colDef) {
                    var rawVal = dbRow[colDef.name];
                    var displayVal = helper.formatCell(rawVal, colDef);
                    helper.debuglog("      Col " + colDef.name + ": raw value=\"" + rawVal +
                                    "\", display value=\"" + displayVal + "\"");
                    var td = helper.createEle(tr, "td", colDef.cssClass);
                    if (colDef.displayType == "html") {
                        // td.innerHTML = "<img src='http://skyserver.sdss.org/dr16/SkyServerWS/ImgCutout/getjpeg?TaskName=Skyserver.Explore.Image&ra=172.591133310995&dec=14.8625695794349&scale=0.2&width=100&height=100' alt='hello'/>";
                        var url = "<img src='http://skyserver.sdss.org/dr16/SkyServerWS/ImgCutout/getjpeg?TaskName=Skyserver.Explore.Image&ra=&dec=&scale=0.1&width=100&height=100' alt='img'/>";
                        var urlra = helper.InsertAt(url, ra.toString(), url.indexOf('ra=')+'ra='.length)
                        var urlradec = helper.InsertAt(urlra, dec.toString(), urlra.indexOf('dec=')+'dec='.length)
                        td.innerHTML = urlradec;
                        // td.style.filter = "brightness(500%)";
                        td.style.filter = "grayscale(100%)";
                    } else {
                        td.innerText = displayVal;
                    }
                });
            });
        } else {
            this.debuglog("   No rows returned");
            if (helper.config.emptyMessage) {
                var tr = helper.createEle(parent, "tr");
                var td = helper.createEle(tr, "td");
                td.colSpan = helper.config.columns.length;
                td.innerHTML = helper.config.emptyMessage;
            }
        }
    },

    // Helper to insert character inside string.
    InsertAt: function(str,CharToInsert,Position){
      return str.slice(0,Position) + CharToInsert + str.slice(Position)
    },

    // convert Ra/Dec in hh:mm:ss to degree
    convertRADEC: function(value) {
      var arr = value.replace('"', '').split(":");
      var degree = (parseFloat(arr[0]) + parseFloat(arr[1])/60 + parseFloat(arr[2])/3600)*15;
      return degree;
    },

    // Format cellules of the table
    formatCell: function(value, cellConf) {
        if (value) {
            if (cellConf.precision) {
                value = value.toFixed(cellConf.precision);
            }

            if (cellConf.thousandsSeparator) {
                value = this.addSeparators(value, cellConf.thousandsSeparator);
            }

            switch (cellConf.dateFormat) {
            case "date":
                value = new Date(value).toLocaleDateString(cellConf.dateLocale);
                break;
            case "time":
                value = new Date(value).toLocaleTimeString(cellConf.dateLocale);
                break;
            case "datetime":
                value = new Date(value).toLocaleString(cellConf.dateLocale);
                break;
            }

            if (cellConf.prefix) {
                value = cellConf.prefix + value;
            }

            if (cellConf.suffix) {
                value = value + cellConf.suffix;
            }
        } else if (cellConf.nullValue) {
            value = cellConf.nullValue;
        }

        return value;
    },


    // http://www.mredkj.com/javascript/numberFormat.html
    addSeparators: function(nStr, sep) {
        nStr += '';
        var x = nStr.split('.');
        var x1 = x[0];
        var x2 = x.length > 1 ? '.' + x[1] : '';
        var rgx = /(\d+)(\d{3})/;
        while (rgx.test(x1)) {
            x1 = x1.replace(rgx, '$1' + sep + '$2');
        }
        return x1 + x2;
    },

    suspend: function() {
        if (!!this.timer) {
            this.debuglog("Suspending");
            clearInterval(this.timer);
            this.timer = null;
        }
    },

    resume: function() {
        this.triggerHelper();
        this.startTimer();
        this.debuglog("Resuming");
    }
});
