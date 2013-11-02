(function(global) {
  "use strict";
  
	function merge_options(obj1, obj2) {
	    var obj3 = {};
	    var attrname;
	    for (attrname in obj1) { obj3[attrname] = obj1[attrname]; }
	    for (attrname in obj2) { obj3[attrname] = obj2[attrname]; }
	    return obj3;
	}

  var Mapsheet = global.Mapsheet = function(options) {
    // Make sure Mapsheet is being used as a constructor no matter what.
    if(!this || !(this instanceof Mapsheet)) {
      return new Mapsheet(options);
    }

    this.key = options.key;
    this.passedMap = options.map;
    this.element = options.element;
		this.sheetName = options.sheetName;
		this.provider = options.provider || Mapsheet.Providers.Google;
		this.renderer = new this.provider( { map: options.passedMap, mapOptions: options.mapOptions } );
		this.fields = options.fields;
		this.titleColumn = options.titleColumn;
		this.popupContent = options.popupContent;
		this.popupTemplate = options.popupTemplate;
		this.callbackContext = options.callbackContext;
		this.callback = options.callback;
		
		// Let's automatically engage simpleSheet mode,
		// which allows for easier using of data later on
		// if you have multiple sheets, you'll want to
		// disable this
		var simpleSheet = true;
		
		if(typeof(this.popupTemplate) === 'string') {
				var source   = document.getElementById(this.popupTemplate).innerHTML;
				this.popupTemplate = Handlebars.compile(source);
		}
		this.markerOptions = options.markerOptions || {};

		if(typeof(this.element) === 'string') {
			this.element = document.getElementById(this.element);
		};

		this.tabletop = new Tabletop( { key: this.key, callback: this.loadPoints, callbackContext: this, simpleSheet: simpleSheet } );
  };


  Mapsheet.prototype = {

    loadPoints: function(data, tabletop) {
			this.points = [];

			if(typeof(this.sheetName) === 'undefined') {
				this.sheetName = tabletop.model_names[0];
			}

			var elements = tabletop.sheets(this.sheetName).elements;
		
			for(var i = 0; i < elements.length; i++) {
				var point = new Mapsheet.Point( { model: elements[i], fields: this.fields, popupContent: this.popupContent, popupTemplate: this.popupTemplate, markerOptions: this.markerOptions, titleColumn: this.titleColumn } );
				this.points.push(point);
			};
		
			this.draw();
    },

    draw: function() {
      this.renderer.initialize(this.element);
      this.renderer.drawPoints(this.points);
      if(this.callback) {
        this.callback.apply(this.callbackContext || this, [this, this.tabletop]);
      }
    },
	
    log: function(msg) {
      if(this.debug) {
        if(typeof console !== "undefined" && typeof console.log !== "undefined") {
          Function.prototype.apply.apply(console.log, [console, arguments]);
        }
      }
    },
    
    map: function() {
      return (this.passedMap || this.renderer.map);
    }

  };

  Mapsheet.Point = function(options) {
		this.model = options.model;
		this.fields = options.fields;
		this.popupContent = options.popupContent;
		this.popupTemplate = options.popupTemplate;
		this.titleColumn = options.titleColumn;
		this.markerOptions = options.markerOptions;
  };

  Mapsheet.Point.prototype = {
		coords: function() {
			return [ this.latitude(), this.longitude() ];
		},

		latitude: function() {
			return parseFloat( this.model["latitude"] || this.model["lat"] );
		},

		longitude: function() {
			return parseFloat( this.model["longitude"] || this.model["lng"] || this.model["long"] );
		},
	
		get: function(fieldName) {
			if(typeof(fieldName) === 'undefined') {
				return;
			}
			return this.model[fieldName.toLowerCase().replace(/ +/,'')];
		},
		
		title: function() {
			return this.get(this.titleColumn);
		},
		
		isValid: function() {
			return !isNaN( this.latitude() ) && !isNaN( this.longitude() )
		},
		
		content: function() {
			var html = "";
			if(typeof(this.popupContent) !== 'undefined') {
				html = this.popupContent.call(this, this.model);
			} else if(typeof(this.popupTemplate) !== 'undefined') {
				html = this.popupTemplate.call(this, this.model);
			} else if(typeof(this.fields) !== 'undefined') {
				if(typeof(this.title()) !== 'undefined' && this.title() !== '') {
					html += "<h3>" + this.title() + "</h3>";
				}
				for(var i = 0; i < this.fields.length; i++) {
					html += "<p><strong>" + this.fields[i] + "</strong>: " + this.get(this.fields[i]) + "</p>";
				}
			} else {
				return '';
			}
			return "<div class='mapsheet-popup'>" + html + "</div>"
		}
  };
	
	/*
	
		Providers only need respond to initialize and drawPoints
	
	*/

	Mapsheet.Providers = {};


	/*
	
		Google Maps
		
	*/
	
	Mapsheet.Providers.Google = function(options) {
		this.map = options.map;
		this.mapOptions = merge_options( { mapTypeId: google.maps.MapTypeId.ROADMAP }, options.mapOptions || {} );
	};

	Mapsheet.Providers.Google.prototype = {
		initialize: function(element) {
			if(typeof(this.map) === 'undefined') {
				this.map = new google.maps.Map(element, this.mapOptions);
			}
			this.bounds = new google.maps.LatLngBounds();
			this.infowindow = new google.maps.InfoWindow({ content: "loading...", maxWidth: '300' });
		},
		
		/* 
			Google Maps only colors markers #FE7569, but turns out you can use
				the Google Charts API to make markers any hex color! Amazing.
				
			This code was pulled from
			http://stackoverflow.com/questions/7095574/google-maps-api-3-custom-marker-color-for-default-dot-marker/7686977#7686977
		*/
		
		setMarkerIcon: function(marker) {
			if(typeof(marker.point.get('icon url')) !== 'undefined' && marker.point.get('icon url') !== '') {
				marker.icon = marker.point.get('icon url');
				return;
			};
			
			if(typeof(marker.point.markerOptions['iconUrl']) !== 'undefined' && marker.point.markerOptions['iconUrl'] !== '') {
				marker.icon = marker.point.markerOptions['iconUrl'];
				return;
			};

			var pinColor = marker.point.get('hexcolor') || "FE7569";
			pinColor = pinColor.replace('#','');
			
	    var pinImage = new google.maps.MarkerImage("http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=|" + pinColor,
	        new google.maps.Size(21, 34),
	        new google.maps.Point(0,0),
	        new google.maps.Point(10, 34));
	    var pinShadow = new google.maps.MarkerImage("http://chart.apis.google.com/chart?chst=d_map_pin_shadow",
	        new google.maps.Size(40, 37),
	        new google.maps.Point(0, 0),
	        new google.maps.Point(12, 35));	 
	  	marker.setShadow(pinShadow);
			marker.setIcon(pinImage);
		},
		
		drawMarker: function(point) {
			var latLng = new google.maps.LatLng(point.latitude(), point.longitude());

      var marker = new google.maps.Marker({
          position: latLng,
					point: point,
					title: point.title()
      });

			this.setMarkerIcon(marker);
			this.initInfoWindow(marker);

			return marker;
		},
		
		/*
			Google only lets you draw one InfoWindow on the page, so you
			end up having to re-write to the original one each time.
		*/
		
		initInfoWindow: function(marker) {
			var infowindow = this.infowindow;
			var clickedOpen = false;
			
			// All of the extra blah blahs are for making sure to not repopulate
			// the infowindow when it's already opened and populated with the 
			// right content
			
      google.maps.event.addListener(marker, 'click', function() {
				if(infowindow.getAnchor() === marker && infowindow.opened) {
					return;
				}
				infowindow.setContent(this.point.content());
				infowindow.open(this.map, this);
				clickedOpen = true;
				infowindow.opened = true;
      });

			// 'eh, general consensus is that hover popups are terrible. 
			// Taking it out for now.
			// 
			// google.maps.event.addListener(marker, 'mouseover', function() {
			// 	if(infowindow.getAnchor() !== marker) {
			// 		clickedOpen = false;
			// 	} else if(infowindow.opened === true) {
			// 		return;
			// 	}
			// 	infowindow.setContent(this.point.content());
			// 	infowindow.open(map, this);
			// 	infowindow.opened = true;
			// });
			// 
			// google.maps.event.addListener(marker, 'mouseout', function() {
			// 	if(!clickedOpen) {
			// 		infowindow.close();
			// 		infowindow.opened = false;
			// 	}
			// });

		},
		
		drawPoints: function(points) {
			for(var i = 0; i < points.length; i++) {
				if(!points[i].isValid()) { continue; }
				var marker = this.drawMarker(points[i]);
				marker.setMap(this.map);
				this.bounds.extend(marker.position);
				points[i].marker = marker;
			};
			this.map.fitBounds(this.bounds);
		}
	}

	/*
	
	MapQuest (OpenStreetMaps & free)
	
	*/
	
	Mapsheet.Providers.MapQuest = function(options) {
		this.map = options.map;
		this.mapOptions = merge_options({ mapTypeId: 'osm', zoom: 13, bestFitMargin: 0, zoomOnDoubleClick: true, latLng:{lat:40.735383, lng:-73.984655} }, options.mapOptions || {});
	};

	Mapsheet.Providers.MapQuest.prototype = {
		initialize: function(element) {
			if(typeof(this.map) === 'undefined') {
				this.map = new MQA.TileMap( merge_options({ elt: element }, this.mapOptions) );
			}
		},

		// We need custom icons!
		
		drawMarker: function(point) {
		  var marker = new MQA.Poi( { lat: point.latitude(), lng: point.longitude() } );

			marker.setRolloverContent(point.title());
			marker.setInfoContentHTML(point.content());

			return marker;
		},

		drawPoints: function(points) {
			for(var i = 0; i < points.length; i++) {
				if(!points[i].isValid()) { continue; }
				var marker = this.drawMarker(points[i]);
			  this.map.addShape(marker);
			};
			this.map.bestFit();
		}
	}

	/*
	
	MapBox
	
	*/
	
	Mapsheet.Providers.MapBox = function(options) {
		this.map = options.map;
		this.mapOptions = merge_options({ mapId: 'examples.map-vyofok3q'}, options.mapOptions || {});
	};

	Mapsheet.Providers.MapBox.prototype = {
		initialize: function(element) {
			if(typeof(this.map) === 'undefined') {
				this.map = mapbox.map( element );
				this.map.addLayer(mapbox.layer().id(this.mapOptions['mapId']));
		    this.map.ui.zoomer.add();
		    this.map.ui.zoombox.add();
			}
		},
		
		drawMarker: function(point) {
			var marker = {
				geometry: {
	          coordinates: [point.longitude(), point.latitude()]
	      },
	      properties: {
	          'marker-color': point.get('hexcolor'),
	          title: point.title(),
	          description: point.content()
	      }
			}
			
			return marker;
		},

		drawPoints: function(points) {
		  this.markerLayer = mapbox.markers.layer();
		  mapbox.markers.interaction(this.markerLayer);
		  this.map.addLayer(this.markerLayer);

		  this.map.zoom(5).center({ lat: 37, lon: -77 });

			for(var i = 0; i < points.length; i++) {
				if(!points[i].isValid()) { continue; }
				var marker = this.drawMarker(points[i]);
				this.markerLayer.add_feature(marker);
			};
			this.map.setExtent(this.markerLayer.extent())
		}
	}

	/*
	
		Did you know you can pass in your own map?
		Check out https://gist.github.com/1804938 for some tips on using different tile providers

	*/
	
	Mapsheet.Providers.Leaflet = function(options) {
		this.map = options.map;
		
		var attribution = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, tiles &copy; <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png" />';
		
		var defaults = {
			subdomains: '1234',
			type: 'osm',
			tilePath: 'http://otile{s}.mqcdn.com/tiles/1.0.0/{type}/{z}/{x}/{y}.png',
			styleId: 998,
			attribution: attribution
		};

		this.mapOptions = merge_options(defaults, options.mapOptions || {});
		this.bounds = new L.LatLngBounds();
	};

	Mapsheet.Providers.Leaflet.prototype = {
		initialize: function(element) {
			if(typeof(this.map) === 'undefined') {
				this.map = new L.Map('map').setView([51.505, -0.09], 13);
				this.tileLayer = new L.TileLayer(this.mapOptions['tilePath'], this.mapOptions).addTo(this.map);
			}
		},
		
		drawMarker: function(point) {
			var marker = L.marker(point.coords())
				.bindPopup(point.content())
			
			if(typeof(point.get('icon url')) !== 'undefined' && point.get('icon url') !== '') {
				var options = merge_options( point.markerOptions, { iconUrl: point.get('icon url') } );
				var icon = L.icon(options);
				marker.setIcon(icon);
			} else if(typeof(point.markerOptions['iconUrl']) !== 'undefined') {
				var icon = L.icon(point.markerOptions);
				marker.setIcon(icon);
			}
				
			// var icon = L.icon();
			// marker.setIcon(icon);

			return marker;
		},

		drawPoints: function(points) {
			for(var i = 0; i < points.length; i++) {
				if(!points[i].isValid()) { continue; }
				var marker = this.drawMarker(points[i]);
				marker.addTo(this.map)				
				this.bounds.extend(marker.getLatLng());
			};
			this.map.fitBounds(this.bounds);			
		}
	}

})(this);