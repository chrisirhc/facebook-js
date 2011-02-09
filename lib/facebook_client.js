var querystring = require('querystring'),
    crypto = require('crypto'),
    http = require('http'),
    URL = require('url'),
		request = require("request");

    // Shameless copy from oAuth module from Ciaran Jessup <ciaranj@gmail.com>
    // TODO: Move to oAuth.get/post instead as my twitter client
    doRequest = function (method, url, callback) {
      var creds = crypto.createCredentials({}),
          parsedUrl = URL.parse(url, true),
          headers = {Host: parsedUrl.host},
          httpClient = null,
          request = null,
          result = '';

      if (parsedUrl.protocol === "https:" && !parsedUrl.port) {
        parsedUrl.port = 443;
      }

      //TODO: Content length should be dynamic when dealing with POST methods....
      headers['Content-Length'] = 0;

      httpClient = http.createClient(parsedUrl.port, parsedUrl.hostname, true, creds);
      request = httpClient.request(method, parsedUrl.pathname + '?' + querystring.stringify(parsedUrl.query), headers);

      httpClient.addListener("secure", function () {
        /* // disable verification for now.
        var verified = httpClient.verifyPeer();
        if(!verified) this.end();   */
      });

      request.addListener('response', function (response) {
        response.addListener("data", function (chunk) {
          result += chunk;
        });

        response.addListener("end", function () {
          if (response.statusCode !== 200) {
            callback({statusCode: response.statusCode, data: result}, null);
          } else {
            callback(null, JSON.parse(result));
          }
        });
      });

      request.end();
    };

    function convertTime(time) {
      return new Date(time).getTime();
    }
		function stringifyMultiQuery(lst) {
 			var res = '&queries=%7B';
			var append = false;	
			for(var e in lst){
				var str = lst[e].replace(/,/gi,'%2C');
						str = str.replace(/=/gi,'%3D');
						str = str.replace(/#/gi,'%23');
						str = str.replace(/ /gi,'+');
						str = str.replace(/\(/gi,'%28');
						str = str.replace(/\)/gi,'%29');
				if(!append) {
					 append = true;
				}else{
					 res = res.concat('%22%2C+');
				}
				res = res.concat('%22').concat(e).concat('%22%3A%22').
				concat(str);
			}
			return res.concat('%22%7D');
		}


module.exports = function (api_key, api_secret) {
  var client = {version: '0.0.2'},
      facebook_graph_url = 'https://graph.facebook.com',
      facebook_api_url = 'https://api.facebook.com';

  //Type tag
  client.TYPE_GROUP = 'group';
  client.TYPE_PAGE = 'page';
  client.TYPE_USER = 'user';

  //RSVP status
  client.RSVP_ATTENDING = 'attending';
  client.RSVP_DECLINED = 'declined';
  client.RSVP_MAYBE = 'maybe';
  client.RSVP_INVITED = 'invited';
  client.RSVP_NOREPLY = 'noreply'; //haven't response to invitation

  client.getAuthorizeUrl = function (options) {
    options = options || {};
    return facebook_graph_url + '/oauth/authorize?' + querystring.stringify(options);
  };

  client.apiCall = function (method, path, params, callback) {
    doRequest(
      method,
      facebook_graph_url + path + '?' + querystring.stringify(params),
      callback
    );
  };

  /**
   * FQL call
   * params: access_token, query_string,
   *	i.e. {access_token: token,
   *	 query:fql,
   *	 format: 'json'},
   * return: query result, i.e. [{"name":"Wang Sha"}]
   */
  client.fqlCall = function (params, callback) {
    doRequest(
      'GET',
      facebook_api_url + '/method/fql.query?' + querystring.stringify(params),
      callback
    );
  };
	
	 /**
   * FQL Multi query call
   * params: access_token, query_string,
   *	i.e. {access_token: token,
   *	 query:fql,
   *	 format: 'json'},
   * return: query result, i.e. [{"name":"Wang Sha"}]
   */
  client.multifqlCall = function (query, params, callback) {
   	doRequest(
      'GET',
      facebook_api_url + '/method/fql.multiquery?' + querystring.stringify(params) + stringifyMultiQuery(query),
      callback
    );
  };

  /**
   * Search facebook event
   * param: search string
   * return event list
   */
  client.searchEvent = function (string, callback) {
    doRequest(
      'GET',
      facebook_graph_url + '/search?type=event&limit=50&' + querystring.stringify({q:string}),
      function (err, response) {
        var bodyObj, i, currId, hashArr;
        if (!err) {
          bodyObj = response.data;
          for (i = bodyObj.length; i--;) {
            bodyObj[i].start_time = convertTime(bodyObj[i].start_time);
            bodyObj[i].end_time = convertTime(bodyObj[i].end_time);
          }
        }
        callback(err, response);
      });
  }

  /**
   * Get current user profile
   * param: access_toke, callback
   * return: user object
   */
  client.getMyProfile = function (token, callback) {
    doRequest(
      'GET',
      facebook_graph_url + '/me?access_token=' + token,
      function (err, result) {
        result.hometown_id = result.hometown.id;
        result.hometown_name = result.hometown.name;
        result.location_id = result.location.id;
        result.location_name = result.location.name;
        result.access_token = token;
        result.picture_small = 'https://graph.facebook.com/' + result.id + '/picture';
          result.type = client.TYPE_USER;
        delete result.hometown;
        delete result.location;
        callback(err, result);
      }
    );
  }

  /**
   * Get event detail
   * param: event_id, callback
   * return: user object
   */
  client.getEventDetail = function (eid, callback) {
    doRequest(
      'GET',
      facebook_graph_url + '/'+ eid,
      function (err, result) {
        result.owner_id = result.owner.id;
        result.owner_name = result.owner.name;
        result.owner_category = result.owner.category; //FB group only
        result.venue_street = result.venue.street;
        result.venue_city = result.venue.city;
        result.venue_country = result.venue.country;
        result.venue_latitude = result.venue.latitude;
        result.venue_longitude = result.venue.longitude;
        delete result.owner;
        delete result.venue;
        callback(err, result);
      }
    );
  }

  /**
   * Get group profile
   * param: group_id, callback
   * return: group object
   */
  client.getGroupInfo = function (id, callback) {
    doRequest(
      'GET',
      facebook_graph_url + '/'+ id,
      function (err, result) {
        result.owner_id = result.owner.id;
        result.owner_name = result.owner.name;
        result.owner_category = result.owner.category;
        result.type = client.TYPE_GROUP;
        result.picture = result.icon;
        delete result.owner;
        callback(err, result);
      }
    );
  }

  /**
   * Get page profile
   * param: page_id, callback
   * return: page object
   */
  client.getPageInfo = function (id, callback) {
    doRequest(
      'GET',
      facebook_graph_url + '/'+ id,
      function (err, result) {
        result.type = client.TYPE_PAGE;
        callback(err, result);
      }
    );
  }


  /**
   * Get event a user/page/group created
   * param: ownder_id {user_id, page_id, group_id}
   * result: a list of events
   */
  client.getEventsCreated = function (ownerid, token, callback) {
    var fql = 'SELECT eid, name, pic, creator FROM event WHERE eid IN (SELECT eid FROM event_member WHERE uid= ' + ownerid +') AND creator= ' + ownerid;
    this.fqlCall({access_token: token,
                 query:fql,
                 format: 'json'},
                 callback);
  }

  /**
   * Get event a user/page/group participated
   * param: id {user_id, page_id, group_id}
   * result: a list of events
   */
  client.getEventsParticipated = function (id, token, callback) {
    var fql = 'SELECT eid, name, pic, creator FROM event WHERE eid IN (SELECT eid FROM event_member WHERE uid= ' + id +')';
    this.fqlCall({access_token: token,
                 query:fql,
                 format: 'json'},
                 callback);
  }

  /**
   * RSVP to an event
   * param: event_id, status {RSVP_ATTENDING, RSVP_MAYBE, RSVP_DECLIENED}
   * return: {true, false}
   */
  client.rsvpEvent = function (eid, token, status, callback) {
    doRequest(
      'POST',
      facebook_graph_url + '/'+ eid + '/' + status + '&access_token=' + token + '&format=json',
      callback
    );

  }

  /**
   * RSVP list of an event
   * param: event_id, status {RSVP_ATTENDING, RSVP_MAYBE, RSVP_DECLIENED, RSVP_INVITED, RSVP_NOREPLY}
   * return: {true, false}
   */
  client.getEventRSVPList = function (eid, token, status, callback) {
    doRequest(
      'GET',
      facebook_graph_url + '/' + eid + '/' + status + '&access_token=' + token,
      callback
    );
  }

  /**
   * Create event
   * param: ownerid {user_id, page_id, group_id}
   * return: event_id, i.e. { id: '187469544608206' }
   */
  client.createEvent = function(ownerid, param, callback) {
    doRequest(
      'POST',
      facebook_graph_url + '/' + ownerid + '/events&' + querystring.stringify(param),
      callback
    );
  }

 /**
   * Get Application Token
   * @param {Object} callback
   */
	client.getAppToken = function(callback) {
		
		request({
			uri: facebook_graph_url + '/oauth/access_token?client_id=' + api_key + '&client_secret=' + api_secret + '&grant_type=client_credentials',
			}, function (error, result, body) {
				 callback(body.substring(13));
			}
		);	
	}
  client.getAccessToken = function (options, callback) {
    var OAuth = require("oauth").OAuth2,
        oAuth = new OAuth(api_key, api_secret, facebook_graph_url);

    options = options || {};

    oAuth.getOAuthAccessToken(
      options.code,
      {redirect_uri: options.redirect_uri},
      function (error, access_token, refresh_token) {
        if (error) {
          callback(error, null);
        } else {
          callback(null, {access_token: access_token, refresh_token: refresh_token});
        }
      }
    );
  };

  return client;

};
