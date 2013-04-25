(function(window, Backbone) {

var route_table_map = {};

function WebSQL(db, route_map, callback) {
	var num_routes = Object.keys(route_map).length;
	var success = _.after(num_routes, function (tx,res) { if (callback) callback(); });
	var error = function (tx,error) { if (callback) callback(new Error(error.message)); };

	for (var route in route_map) {
		var store = route_map[route];
		if (typeof store == 'string')
			store = {'table': store};
		store.db = db;
		store.cols = store.cols || [];

		route_table_map[route] = store;
		var colDefns = ["`id` unique", "`value`"];
		colDefns = colDefns.concat(store.cols.map(createColDefn));
		
		var sql = 'CREATE TABLE IF NOT EXISTS `' + store.table + '` ' +
		  '(' + colDefns.join(', ') + ');';
		 console.log(sql);
		_executeSql(db, sql, null, success, error, {});
	}
};

WebSQL.debug = false;
WebSQL.insertOrReplace = false;

Backbone.sync = function(method, model, options) {
	var store;
	var url = options.url || _.result(model, 'url');
	if (!url)
		throw new Error('No url for: ' + method + ', ' + model.toJSON());
	for (var route in route_table_map)
		if (url.slice(0, route.length) == route)
			store = route_table_map[route];

	if (!store)
		throw new Error('url (' + url + ') does not map to a route: ' +
			Object.keys(route_table_map));
	
	var isSingleResult = false;
	
	switch(method) {
		case "read":
			if (model.attributes && model.attributes[model.idAttribute]) {
				isSingleResult = true;
				find(store, model, success, error, options)
			} else {
				findAll(store, model, success, error, options)
			}
			break;
		case "create":
		  create(store, model, success, error, options);
			break;
		case "update":
		  update(store, model, success, error, options);
			break;
		case "delete":
		  destroy(store, model, success, error, options);
			break;
		default:
			window.console.error(method);
	}

	function success(tx, res) {
		var len = res.rows.length;
		if (len > 0) {
			var result = [];

			for (var i = 0; i < len; i++)
				result.push(JSON.parse(res.rows.item(i).value));
			
			if (isSingleResult && result.length !== 0)
				result = result[0];
		} 
		
		options.success(result);
	}

	function error(tx, error) {
		console.error(error);
		options.error(error);
	}
};

function create(store, model,success,error,options) {
	//when you want use your id as identifier, use apiid attribute
	if(!model.attributes[model.idAttribute]) {
		// Reference model.attributes.apiid for backward compatibility.
		var obj = {};

		if(model.attributes.apiid){
			obj[model.idAttribute] = model.attributes.apiid;
			delete model.attributes.apiid;
		}else{
			obj[model.idAttribute] = guid();
		}			 
		model.set(obj);
	}

	var colNames = ["`id`", "`value`"];
	var placeholders = ['?', '?'];
	var params = [model.attributes[model.idAttribute], JSON.stringify(model.toJSON())];
	store.cols.forEach(function(col) {
		colNames.push("`" + col + "`");
		placeholders.push(['?']);
		params.push(model.attributes[col]);
	});
	var orReplace = WebSQL.insertOrReplace ? ' OR REPLACE' : '';
	_executeSql(store.db, "INSERT" + orReplace + " INTO `" + store.table + "` (" + colNames.join(",") + ") VALUES(" + placeholders.join(",") + ");", params, success, error, options);
}

function destroy(store, model, success, error, options) {
	//window.console.log("sql destroy");
	var id = (model.attributes[model.idAttribute] || model.attributes.id);
	_executeSql(store.db, "DELETE FROM `" + store.table + "` WHERE(`id`=?);", [model.attributes[model.idAttribute]], success, error, options);
}

function find(store, model, success, error, options) {
	//window.console.log("sql find");
	var id = (model.attributes[model.idAttribute] || model.attributes.id);
	_executeSql(store.db, "SELECT `id`, `value` FROM `" + store.table + "` WHERE(`id`=?);",[model.attributes[model.idAttribute]], success, error, options);
}

function findAll(store, model, success, error, options) {
	//window.console.log("sql findAll");
	var params = [];
	var sql = "SELECT `id`, `value` FROM `" + store.table + "`";
	if (options.filters) {
		if (typeof options.filters == 'string') {
			sql += ' WHERE ' + options.filters;
		}
		else if (typeof options.filters == 'object') {
			sql += ' WHERE ' + Object.keys(options.filters).map(function(col) {
				params.push(options.filters[col]);
				return '`' + col + '` = ?';
			}).join(' AND ');
		}
		else {
			throw new Error('Unsupported filters type: ' + typeof options.filters);
		}
	}
	_executeSql(store.db, sql, params, success, error, options);			
}

function update(store, model, success, error, options) {
	if (WebSQL.insertOrReplace)
		return create(store, model, success, error, options);

	//window.console.log("sql update")
	var id = (model.attributes[model.idAttribute] || model.attributes.id);

	var setStmts = ["`value`=?"];
	var params = [JSON.stringify(model.toJSON())];
	store.columns.forEach(function(col) {
		setStmts.push("`" + col + "`=?");
		params.push(model.attributes[col]);
	});
	params.push(model.attributes[model.idAttribute]);
	_executeSql(store.db, "UPDATE `" + store.table + "` SET " + setStmts.join(" AND ") + " WHERE(`id`=?);", params, function(tx, result) {
		if (result.rowsAffected == 1)
			success(tx, result);
		else
			error(tx, new Error('UPDATE affected ' + result.rowsAffected + ' rows'));
	}, error, options);
}

function _executeSql(db, SQL, params, successCallback, errorCallback, options) {
	var success = function(tx,result) {
		if (WebSQL.debug) { window.console.log(SQL, params, " - finished"); }
		if (successCallback) successCallback(tx,result);
	};
	var error = function(tx,error) {
		if (WebSQL.debug) { window.console.error(SQL, params, " - error: " + error) };
		if (errorCallback) return errorCallback(tx,error);
	};
	
	if (options.transaction) {
		options.transaction.executeSql(SQL, params, success, error);
	}
	else {
		db.transaction(function(tx) {
			tx.executeSql(SQL, params, success, error);
		});
	}
}

var typeMap = {
	"number": "INTEGER",
  "string": "TEXT",
  "boolean": "BOOLEAN",
  "array": "LIST",
  "datetime": "TEXT",
  "date": "TEXT",
  "object": "TEXT"
};
function createColDefn(col) {
	// var name = typeof col == 'string' ? col : col.name;
	// if (col.type && !(col.type in typeMap))
	// 	throw new Error("Unsupported type: " + col.type);

	return "`" + col + "`";
	// if (col.type) {
	// 	if (col.scale)
	// 		defn += " REAL";
	// 	else
	// 		defn += " " + typeMap[col.type];
	// }
	// return defn;
}

Backbone.WebSQL = WebSQL;

function S4() {
   return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
}
var VERSION_VALUE = 0x4;// Bits to set
var VERSION_CLEAR = 0x0;// Bits to clear
var VARIANT_VALUE = 0x8;// Bits to set for Standard variant (10x)
var VARIANT_CLEAR = 0x3;// Bits to clear
function guid() {
	var data3_version = S4();
	data3_version = (parseInt( data3_version.charAt( 0 ), 16 ) & VERSION_CLEAR | VERSION_VALUE).toString( 16 )
		+ data3_version.substr( 1, 3 );
	var data4_variant = S4();
	data4_variant = data4_variant.substr( 0, 2 )
		+ (parseInt( data4_variant.charAt( 2 ), 16 ) & VARIANT_CLEAR | VARIANT_VALUE).toString( 16 )
		+ data4_variant.substr( 3, 1 );
	return( S4() + S4() + '-' + S4() + '-' + data3_version + '-' + data4_variant + '-' + S4() + S4() + S4());
}

})(this, Backbone);