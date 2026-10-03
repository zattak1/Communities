<?php
/**
 * @module Communities
 */
/**
 * Class for dealing with Communities import
 *
 * @class Communities_Import
 */
class Communities_Import
{
	/**
	 * Grant admin permissions to some user.
	 * @method grantUserAccess
	 * @static
	 * @param {Users_User|string} $user User to be accessed. Can be Users_User object or user Id string.
	 * @param {Users_User|string} [$admin=null] User which gets access. Can be Users_User object or user Id string.
	 * If null - logged user.
	 */
	static function grantUserAccess($user, $admin = null)
	{
		if (!$admin) {
			$admin = Users::loggedInUser(true, false);
		}

		$params = array(
			'userId' => gettype($user) === 'string' ? $user : $user->id,
			'label' => "Users/admins",
			'contactUserId' => gettype($admin) === 'string' ? $admin : $admin->id,
		);

		if (!Users_Contact::select()->where($params)->ignoreCache()->fetchDbRows()) {
			Users_Contact::insert($params)->execute();
		}
	}
	/**
	 * Deny admin permissions from some user.
	 * @method denyUserAccess
	 * @static
	 * @param {Users_User|string} $user User to be accessed. Can be Users_User object or user Id string.
	 * @param {Users_User|string} [$admin=null] User which gets access. Can be Users_User object or user Id string.
	 * If null - logged user.
	 */
	static function denyUserAccess($user, $admin = null)
	{
		if (!$admin) {
			$admin = Users::loggedInUser(true, false);
		}

		Users_Contact::select()->where(array(
			'userId' => gettype($user) === 'string' ? $user : $user->id,
			'label' => "Users/admins",
			'contactUserId' => gettype($admin) === 'string' ? $admin : $admin->id,
		))->ignoreCache()->fetchDbRow()->remove();
	}
	/**
	 * Apply user to interests.
	 * @method applyInterests
	 * @static
	 * @param {Users_User|string} $user
	 * @param {array} $interests Array of interests titles
	 */
	static function applyInterests($user, $interests)
	{
		foreach ($interests as $item) {
			Q::event('Streams/interest/post', array(
				'title' => $item,
				'userId' => gettype($user) === 'string' ? $user : $user->id
			));
		}
	}
	/**
	 * Update users greeting stream
	 * @method updateGreeting
	 * @static
	 * @param {Users_User|string} $user
	 * @param {array} $data
	 * @param {string} [$communityId=null] Community id where interests published. If null - main community.
	 */
	static function updateGreeting($user, $data)
	{
		$communityId = Users::communityId();

		$userId = gettype($user) === 'string' ? $user : $user->id;

		$streamName = "Streams/greeting/$communityId";
		$greetingStream = Streams_Stream::fetch($userId, $userId, $streamName);
		if (!$greetingStream) {
			$greetingStream = Streams::create($userId, $userId, "Streams/greeting", array(
				'name' => $streamName
			));
		}

		$greetingContent = "";

		if (Q::ifset($data, 'position', null)) {
			$greetingContent .= $data['position'];
		}

		if (Q::ifset($data, 'organization', null)) {
			if ($greetingContent) {
				$greetingContent .= ', ';
			}
			$greetingContent .= $data['organization'];
		}

		if (Q::ifset($data, 'country', null)) {
			$greetingContent .= "\n".$data['country']."\n";
		}

		if (Q::ifset($data, 'info', null)) {
			$greetingContent .= "\n".$data['info'];
		}

		$greetingStream->content = $greetingContent;
		$greetingStream->save();
	}
	/**
	 * Create person and set as Users/admins of community
	 * @method updateContact
	 * @static
	 * @param {Users_User|string} $user
	 * @param {string} $name
	 * @param {string} $email
	 */
	static function updateContact($community, $name, $email, $activateUsers)
	{
		$person = Users_User::select()
			->where(array('emailAddress' => $email))
			->orWhere(array('emailAddressPending' => $email))
			->ignoreCache()
			->fetchDbRow();

		if (empty($person)) {
			$person = Streams::register(
				$name,
				$email,
				true,
				array(
					'activation' => $activateUsers
				)
			);

			$person->sessionCount = 2;
			$person->save();
			Streams::$cache['fullName'] = null;
		}

		$streamName = 'Streams/experience/main';
		// Streams::invite return exception "Class Id not extend DbRow"
		//Streams::invite($community->id, $streamName, array('userId' => $person->id));

		// set person as Users/admins (if user doesn't get invitation for some reason)
		$usersContact = new Users_Contact();
		$usersContact->userId = $community->id;
		$usersContact->contactUserId = $person->id;
		$usersContact->label = "Users/admins";
		if (!$usersContact->retrieve()) {
			$usersContact->nickname = "Admin";
			$usersContact->save();
		}

		// join person to community
		Streams::join($person->id, $community->id, array($streamName), array('skipAccess' => true));
	}
	/**
	 * Update users location
	 * @method updateLocation
	 * @static
	 * @param {Users_User|string} $user
	 * @param {string|array} $address If array, looking for 'address', 'city', 'state', 'country' keys, and create address string
	 */
	static function updateLocation($user, $address)
	{
		if (is_array($address)) {
			$address = array_filter(array(
				Q::ifset($address, 'address', null),
				Q::ifset($address, 'city', null),
				Q::ifset($address, 'state', null),
				Q::ifset($address, 'country', null)));
			$address = implode(',', $address);
		}
		if (empty($address)) {
			return null;
		}
		$location = Places::autocomplete($address, true);
		$globalLocationStream = Places_Location::stream($user->id, $user->id, $location[0]['place_id'], array(
			'throwIfBadValue' => true
		));

		if (!$globalLocationStream) {
			return null;
		}

        $locationStream = Streams_Stream::fetchOrCreate($user->id, $user->id, 'Places/user/location');
		$locationStream->attributes = $globalLocationStream->attributes;
		$locationStream->save();
	}
	/**
	 * Update users birthday
	 * @method updateBirthday
	 * @static
	 * @param {Users_User|string} $user
	 * @param {string|array} $data If array, looking for 'DOB' key, and create Streams/date/birthday stream
	 */
	static function updateBirthday($user, $data)
	{
		$dob = Q::ifset($data, "birthday", null);
		if (empty($dob)) {
			return;
		}

		$userId = gettype($user) === 'string' ? $user : $user->id;

		$streamName = "Streams/date/birthday";
		$birthdayStream = Streams_Stream::fetch($userId, $userId, $streamName);
		if (!$birthdayStream) {
			$birthdayStream = Streams::create($userId, $userId, "Streams/date/birthday", array(
				'name' => $streamName
			));
		}

		$birthdayStream->content = date("Y-m-d", strtotime($dob));
		$birthdayStream->save();
	}
	/**
	 * Update users urls
	 * @method updateURL
	 * @static
	 * @param {Users_User|string} $user
	 * @param {string} $url
	 * @param {string} $title like 'LinkedIn' or 'Twitter'
	 */
	static function updateURL($user, $url)
	{
		if (!filter_var($url, FILTER_VALIDATE_URL)) {
			return;
		}

		$userId = gettype($user) === 'string' ? $user : $user->id;

		// if Streams/user/urls category doesn't exist, create one
		$categoryStreamName = "Streams/user/urls";
		if (!Streams_Stream::fetch($userId, $userId, $categoryStreamName)) {
			Q_Config::load(STREAMS_PLUGIN_DIR.DS.'config'.DS.'streams.json');
			$streamsConfig = Q_Config::get($categoryStreamName, null);
			Streams::create($userId, $userId, Q::ifset($streamsConfig, "type", "Streams/category"), array(
				'name' => $categoryStreamName
			));
		}

		Q::event("Websites/webpage/post", array(
			"action" => "start",
			"url" => $url,
			"categoryStream" => array(
				"publisherId" => $userId,
				"streamName" => $categoryStreamName,
				"relationType" => "Websites/webpage"
			),
			"message" => ""
		));
	}
	/**
	 * Update socials
	 * @method updateSocialStreams
	 * @static
	 * @param {Users_User|string} $user
	 * @param {array} $data - array with key <social> or <social>_url
	 */
	static function updateSocialStreams ($user, $data) {
		$supportedSocials = Q_Config::get("Communities", "profile", "social", array());
		$supportedSocials = array_keys($supportedSocials);
		foreach ($supportedSocials as $supportedSocial) {
			$value = Q::ifset($data, $supportedSocial, Q::ifset($data, $supportedSocial."_url", null));
			if (!$value) {
				continue;
			}

			$userId = gettype($user) === 'string' ? $user : $user->id;
			$streamName = "Streams/user/".Q_Utils::normalize(trim($supportedSocial));

			$stream = Streams_Stream::fetch($userId, $userId, $streamName);
			if ($stream) {
				$stream->content = $value;
				$stream->title = Q_Utils::ucfirst($supportedSocial);
				$stream->save();
			} else {
				Q_Config::load(COMMUNITIES_PLUGIN_DIR.DS.'config'.DS.'streams.json');
				$streamsConfig = Q_Config::get($streamName, null);
				$streamType = Q::ifset($streamsConfig, "type", "Streams/text");
				Streams::create($userId, $userId, $streamType, array(
					'name' => $streamName,
					'content' => $value,
					'title' => Q_Utils::ucfirst($supportedSocial)
				));
			}
		}
	}
	/**
	 * Create or update users gender
	 * @method setGender
	 * @static
	 * @param {Users_User|string} $user
	 * @param {string} $gender Community where to search events
	 */
	static function setGender($user, $gender) {
		$streamName = 'Streams/user/gender';
		$gender = strtolower($gender);
		$stream = Streams_Stream::fetch($user->id, $user->id, $streamName);

		if ($stream instanceof Streams_Stream) {
			$stream->content = $gender;
			$stream->save();
		} else {
			Streams::create($user->id, $user->id, null, array(
				'name' => $streamName,
				'content' => $gender
			));
		}
	}
	/**
	 * Join user to random event
	 * @method joinRandomEvent
	 * @static
	 * @param {Users_User|string} $user
	 * @param {string} $communityId Community where to search events
	 */
	static function joinRandomEvent($user, $communityId = null)
	{
		$userId = gettype($user) === 'string' ? $user : $user->id;
		$communityId = $communityId ? $communityId : Users::currentCommunityId(true);

		Q_Config::set('Streams', 'db', 'limits', 'stream', 1000);
		$events = Streams::related($communityId, $communityId, "Calendars/calendar/main", true, array(
			'type' => 'Calendars/events',
			'weight' => new Db_Range(time(), false, false, null),
			'limit' => 1000
		))[1];

		if(!empty($events) && is_array($events)) {
			// filter events with full peopleMax
			foreach ($events as $name => $stream) {
				// check whether events have max participated users
				$participated = Streams_Participant::select("count(*) as res")
					->where(array(
						"streamName" => $name,
						"extra like " => '%"going":"yes"%'
					))
					->ignoreCache()
					->execute()
					->fetchAll(PDO::FETCH_ASSOC)[0]["res"];

				if ($participated >= $stream->getAttribute('peopleMax')) {
					unset($events[$name]);
				}
			}

			if (!empty($events)) {
				// have user go to a random event
				Calendars_Event::going($events[array_rand($events)], $userId, 'yes');
			}
		}
	}
	/**
	 * Update users email address (if not exist yet)
	 * @method updateEmail
	 * @static
	 * @param {Users_User|string} $user
	 * @param {string} $emailAddress
	 */
	static function updateEmail($user, $emailAddress)
	{
		$user = gettype($user) === 'string' ? Users::fetch($user, true) : $user;

		if (Q::ifset($user, 'emailAddress', null)) {
			return;
		}
		// Never take an address another user signs in with: $verified = true
		// would reassign the row to this user (ro#942).
		if (Users::identifierOwnedElsewhere('email', $emailAddress, $user->id)) {
			return;
		}

		$user->setEmailAddress($emailAddress, true);
	}
	/**
	 * Update users mobile (if not exist yet)
	 * @method updateMobile
	 * @static
	 * @param {Users_User|string} $user
	 * @param {string} $mobileNumber
	 */
	static function updateMobile($user, $mobileNumber)
	{
		$user = gettype($user) === 'string' ? Users::fetch($user, true) : $user;

		if (Q::ifset($user, 'mobileNumber', null)) {
			return;
		}
		if (Users::identifierOwnedElsewhere('mobile', $mobileNumber, $user->id)) {
			return; // see updateEmail (ro#942)
		}

		$user->setMobileNumber($mobileNumber, true);
	}
	/**
	 * Join user to Streams/experience/main stream of community
	 * @method subscribeToCommunity
	 * @static
	 * @param {Users_User|string} $user
	 * @param {string} $communityId
	 * @param {string} $label Label to add to users_contact
	 */
	static function subscribeToCommunity ($user, $communityId, $label=null) {
		$user = gettype($user) === 'string' ? Users::fetch($user, true) : $user;

		$experienceStream = Streams_Stream::fetch($communityId, $communityId, 'Streams/experience/main');
		$participant = $experienceStream->participant($user->id);
		if (!($participant instanceof Streams_Participant) || $participant->state != 'participating') {
			$experienceStream->subscribe(array('userId' => $user->id, 'skipAccess' => true));
		}

		if ($label) {
			Users_Contact::addContact($communityId, $label, $user->id, '', null, true);
		}
	}

	/**
	 * Whether an image URL from an import (a CSV photo_url, cover_url or icon
	 * cell, or an image-search result) may be imported: an absolute http or
	 * https URL. Q_Valid::url() alone also accepts file:// and php://, which
	 * would let a CSV cell name a file on this server (ro#1045). The URL is then
	 * requested only through Q_Fetch, which also refuses private targets.
	 * @method isPhotoUrl
	 * @static
	 * @param {mixed} $url
	 * @return {boolean}
	 */
	static function isPhotoUrl($url)
	{
		return is_string($url)
			&& preg_match('#^https?://#i', $url)
			&& Q_Valid::url($url);
	}

	/**
	 * Prepare icon for import to user
	 *
	 * @method prepareIcon
	 * @static
	 * @param {String} $iconUrl
	 * @param {Boolean} [$throw=false] If true - throws exception
	 * @return {Array}
	 * @throws
	 */
	static function prepareIcon ($iconUrl, $throw = false) {
		if (Q_Config::get('Communities', 'community', 'importUsers', 'image', 'removeBackground', false)) {
			$filename = basename(parse_url($iconUrl, PHP_URL_PATH));
			$savePath = implode(DS, [APP_FILES_DIR, Users::communityId(), "uploads", "Users", $filename]);
			try {
				// A URL is fetched only through Q_Fetch (http/https, public
				// targets, redirects re-checked), never a stream wrapper; a
				// plain path comes only from server code (ro#1045).
				if (preg_match('#^[a-z][a-z0-9+.-]*:#i', $iconUrl)) {
					$response = Q_Fetch::get($iconUrl, array('maxBytes' => 5242880));
					$iconData = ($response['status'] === 200 && !$response['truncated'])
						? $response['body'] : false;
				} else {
					$iconData = is_file($iconUrl) ? file_get_contents($iconUrl) : false;
				}
				if (!$iconData) {
					throw new Exception("Couldn't download file from ".$iconUrl);
				}

				$response = AI_Image::create('RemoveBG')->removeBackground(base64_encode($iconData));
				if (!empty($response['error'])) {
					throw new Exception($response['error']);
				}

				if (!file_put_contents($savePath, $response['data'])) {
					throw new Exception("Couldn't save file to ".$savePath);
				}
				$iconUrl = implode('/', [APP_WEB_DIR, "Q", "uploads", "Users", $filename]);
			} catch (Exception $exception) {
				if ($throw) {
					throw $exception;
				}
				//echo $exception->getMessage();
			}
		}

		return Q_Image::iconArrayWithUrl($iconUrl, 'Users/icon');
	}

	/**
	 * Import user icon
	 *
	 * @method importIcon
	 * @static
	 * @param {Users_User} $user
	 * @param {String} $iconUrl
	 * @param {String} [$service] Which service to use for search icon (google, facebook)
	 * @throws
	 */
	static function importIcon ($user, $iconUrl, $service=null) {
		$icon = self::prepareIcon($iconUrl);
		$cookie = $service ? Q_Config::get('Q', 'images', $service, 'cookie', null) : null;
		$dir = Users::importIcon($user, $icon, null, $cookie);
		if (!$dir || !is_dir($dir)) {
			return;
		}

		$user->save();
		Streams_Avatar::update()->set(array(
			'icon' => $user->icon
		))->where(array(
			'publisherId' => $user->id
		))->execute();
	}
	/**
	 * Make users import from CSV file.
	 *
	 * @method users
	 * @static
	 * @param {Streams_Stream} $taskStream Required. Stream with filled instruction field.
	 * @throws
	 */
	static function users($taskStream)
	{
		// increase memory limit
		ini_set('memory_limit', '500M');

		$texts = Q_Text::get('Communities/content')['import'];
		$communityId = $taskStream->getAttribute('communityId', Users::currentCommunityId(true));
		$mainCommunity = Users::communityId();

		if (!($taskStream instanceof Streams_Stream)) {
			throw new Exception($texts['taskStreamInvalid']);
		}

		$instructions = $taskStream->instructions;
		$joinToRandomEvent = (bool)$taskStream->getAttribute('joinToRandomEvent');
		$setUrlAsConversation = (bool)$taskStream->getAttribute('setUrlAsConversation');
		$toMainCommunityToo = (bool)$taskStream->getAttribute('toMainCommunityToo');
		$activateUsers = (bool)$taskStream->getAttribute('activateUsers');

		// init errors
		$taskStream->errors = json_encode(array());
		$taskStream->save();

		if (empty($instructions)) {
			throw new Exception($texts['instructionsEmpty']);
		}
		$instructions = json_decode($instructions);

		$luid = Users::loggedInUser(true)->id;

		// Send the response and keep going.
		// WARN: this potentially ties up the PHP thread for a long time
		$timeLimit = Q_Config::get('Streams', 'import', 'timeLimit', 100000);
		ignore_user_abort(true);
		set_time_limit($timeLimit);
		session_write_close();

		// count the number of rows
		$lineCount = count($instructions);
		$taskStream->setAttribute('items', $lineCount);

		$requiredFields = array(
			'name' => array('full_name', array('first_name', 'last_name'))
		);

		// use empty arguments, so it will use main community
		// because we have json file only for main community
		$allInterests = Streams::interests();

		$fields = array();

		// start parsing the rows
		foreach ($instructions as $j => $line) {
			if (!$line) {
				continue;
			}

			Q::event('Communities/import/users', array("count" => $j), 'before', false, $line);

			if (++$j === 1) {
				// get the fields from the first row
				$fields = array_map(function ($val) {
					return Q_Utils::normalize(trim($val));
				}, $line);

				// check for required fields
				foreach($requiredFields as $key => $item) {
					if (is_array($item)) {
						$requiredFieldExist = false;
						foreach ($item as $item2) {
							if (is_array($item2) && count(array_intersect($item2, $fields)) == count($item2)) {
								$requiredFieldExist = true;
							} elseif (in_array($item2, $fields)) {
								$requiredFieldExist = true;
							}
						}

						if (!$requiredFieldExist) {
							$taskStream->errors = json_encode([Q::interpolate($texts['fieldNotFound'], array($item[0]))]);
							$taskStream->save();
							break 2;
						}
					} elseif (!in_array($item, $fields)) {
						$taskStream->errors = json_encode([Q::interpolate($texts['fieldNotFound'], array($item[0]))]);
						$taskStream->save();
						break 2;
					}
				}

				continue;
			}

			$processed = $taskStream->getAttribute('processed', 0);
			if ($j <= $processed) {
				continue;
			}
			$empty = true;
			foreach ($line as $v) {
				if ($v) {
					$empty = false;
					break;
				}
			}
			if ($empty) {
				continue;
			}

			$data = array();

			try {
				foreach ($line as $i => $value) {
					$field = $fields[$i];

					if ($field == 'interest') {
						$value = array_map('trim', preg_split("/\r\n|\n|\r/", trim($value)));
						// check interests separated by comma
						if (sizeof($value) == 1) {
							$value = array_map('trim', explode(",", $value[0]));
						}
						// check interests separated by semicolon
						if (sizeof($value) == 1) {
							$value = array_map('trim', explode(";", $value[0]));
						}

						foreach ($value as $interestKey => $item) {
							if (empty($item) || Q_Utils::normalize($item) == "_") {
								continue;
							}

							// if interest category not defined, set it to Other
							if (strpos($item, ':') === false) {
								$value[$interestKey] = $item = "Other:".$item;
							}
							$parsedItem = array_map('trim', explode(":", $item));

							if (!array_key_exists($parsedItem[0], $allInterests) && !Q_Config::get('Communities', 'community', 'importUsers', 'allowAnyInterests', false)) {
								//throw new Exception(Q::interpolate($texts['interestAbsent'], array($item)));
								unset($value[$interestKey]);
								continue;
							}

							// create interest stream if not exists
							Streams::getInterest($item);
						}
					} elseif ($field == 'label' && !empty($value)) {
						$rows = array_map('trim', preg_split("/\r\n|\n|\r/", trim($value)));
						$result = array();
						foreach ($rows as $row) {
							$result = array_merge($result, explode(',', $row));
						}
						$value = array_map('trim', $result);
					} elseif ($field == 'conversation_url') {
						$value = array_map('trim', preg_split("/\r\n|\n|\r/", trim($value)));
					} elseif ($field == 'first_name') {
                        // concatenate first_name and last_name to full_name
                        $data['full_name'] = trim($value) . ' ' . trim($line[$i + 1]);
                    } else {
						$value = trim(preg_replace("/[\n\r|\n|\r]/", " ", $value));

						if ($field == 'email_address') {
							$value = strtolower($value);
						}
					}

					$data[$field] = $value;
				}

				// check if user already exist
				if (!empty($data['email_address'])) {
					$addedUsers = Users_User::select()
						->where(array('emailAddress' => $data['email_address']))
						->orWhere(array('emailAddressPending' => $data['email_address']))
						->ignoreCache()
						->fetchDbRows();
				} elseif (!empty($data['mobile_number'])) {
					$addedUsers = Users_User::select()
						->where(array('mobileNumber' => $data['mobile_number']))
						->orWhere(array('mobileNumberPending' => $data['mobile_number']))
						->ignoreCache()
						->fetchDbRows();
				} else { // if email empty, check by name
					$splittedName = Streams::splitFullName($data['full_name']);
					$addedUsers = Streams_Avatar::select()->where(array(
						'firstName' => $splittedName['first'],
						'lastName' => $splittedName['last']
					))->ignoreCache()->fetchDbRows();
				}

				// Whether this row matched someone already in the system. Only a
				// user this import creates may have identifiers set without
				// proof; an existing one - matched by email, mobile or merely by
				// name - gets an activation message instead, or an admin's CSV
				// could give any namesake a sign-in address (ro#942).
				$existingUser = (bool) $addedUsers;
				if ($addedUsers) {
					$userId = Q::ifset($addedUsers[0], 'id', Q::ifset($addedUsers[0], 'publisherId', null));

					if (!$userId) {
						throw new Exception($texts['userIdNotFound']);
					}

					$user = Users::fetch($userId, true);
				} else {
					$identifier = Q::ifset($data, 'email_address', Q::ifset($data, 'mobile_number', null));
					$identifier = strtolower($identifier);

					// wait random seconds
					//sleep(rand()%5);

					// create new user
					$user = Streams::register(
						$data['full_name'],
						$identifier,
						self::isPhotoUrl($data['photo_url']) && Q_Image::isRealImage($data['photo_url']) ? self::prepareIcon($data['photo_url']) : true,
						array(
							'activation' => $activateUsers,
							'skipIdentifier' => true
						)
					);
					if (!Users::isCommunityId($user->id)) {
						$user->username = Q_Utils::normalize(trim($data['full_name']));
					}
					$user->sessionCount = 1;
					$user->save();
					Streams::$cache['fullName'] = null;
				}

				// temporary assign admin permissions to logged user
				// it need to save custom icon
				self::grantUserAccess($user);

				// update icon if not custom
				if (!Users::isCustomIcon($user->icon)) {
					if (self::isPhotoUrl($data['photo_url']) && Q_Image::isRealImage($data['photo_url'])) {
						self::importIcon($user, $data['photo_url']);
					} elseif (!$user->get('leaveDefaultIcon', false)
						and !$user->get('skipIconSearch', false)
						and $search = Q_Config::get('Users', 'register', 'icon', 'search', array())) {
						if ($search) {
							foreach ($search as $service) {
								try {
									$iconUrls = call_user_func(
										array('Q_Image', $service), $data['full_name'], array(), false
									);

									foreach ($iconUrls as $iconUrl) {
										if (!self::isPhotoUrl($iconUrl) || !Q_Image::isRealImage($iconUrl)) {
											continue;
										}

										self::importIcon($user, $iconUrl, $service);
										break 2;
									}

								} catch (Exception $e) {}
							}
						}
					}
				}

				// join new user to current community
				self::subscribeToCommunity($user, $communityId, $data['label']);

				if ($toMainCommunityToo && $communityId != $mainCommunity) {
					// join new user to main community
					self::subscribeToCommunity($user, $mainCommunity, $data['label']);
				}

				// update email
				if (!empty($data['email_address'])) {
					if ($activateUsers or $existingUser) {
						$user->addEmail($data['email_address']);
					} else {
						self::updateEmail($user, $data['email_address']);
					}
				}

				// update mobile
				if (!empty($data['mobile_number'])) {
					if ($activateUsers or $existingUser) {
						$user->addMobile($data['mobile_number']);
					} else {
						self::updateMobile($user, $data['mobile_number']);
					}
				}

				if (is_array($data['interest'])) {
					// connect user to all interests
					self::applyInterests($user, $data['interest']);
				}

				// greeting stream
				self::updateGreeting($user, $data);

				// update location stream
				self::updateLocation($user, $data);

				// update Streams/date/birthday stream
				self::updateBirthday($user, $data);

				// Blog url
				if (!empty($data['blog_url'])) {
					self::updateURL($user, $data['blog_url']);
				}

				// Social networks
				self::updateSocialStreams($user, $data);

				// Gender
				if (!empty($data['gender'])) {
					self::setGender($user, $data['gender']);
				}

				// join user to random event only once if joinToRandomEvent==true
				if (!$addedUsers && $joinToRandomEvent) {
					self::joinRandomEvent($user, $communityId);
				}

				if ($setUrlAsConversation && !empty($data['blog_url']) && class_exists('Websites_Webpage')) {
					if (!is_array($data['blog_url'])) {
						$data['blog_url'] = array($data['blog_url']);
					}

					foreach ($data['blog_url'] as $item) {
						if (parse_url($item, PHP_URL_SCHEME) === null) {
							$item = 'http://'.$item;
						}

						if (!Q_Valid::url($item)) {
							continue;
						}

						// skip already added
						if (Websites_Webpage::fetchStream($item)) {
							continue;
						}

						$websitesWebpageData = Websites_Webpage::scrape(trim($item));
						$websitesWebpageData['publisherId'] = $user->id;
						Q::event('Websites/webpage/response/start', array(
							'data' => $websitesWebpageData
						));
					}
				}

				// apply cover image
				$coverIcon = self::isPhotoUrl($data['cover_url'])
					? Q_Image::iconArrayWithUrl($data['cover_url'], 'Users/cover')
					: null;
				if ($coverIcon) {
					Users::importIcon($user, $coverIcon, APP_FILES_DIR.DS.Q::app().DS.'uploads'.DS.'Users'.DS.Q_Utils::splitId($user->id).DS.'cover'.DS);
				}

				// remove temp access row
				self::denyUserAccess($user);
			} catch (Exception $e) {
				// save error to stream
				$exceptions = json_decode($taskStream->errors, true);
				$exceptions[$j] = $e->getMessage();
				$taskStream->errors = json_encode($exceptions);
				$taskStream->save();
			}

			$processed = $j;
			$taskStream->setAttribute('processed', $processed);
			$progress = ($j/$lineCount) * 100;
			$taskStream->setAttribute('progress', $progress);
			$taskStream->save();
			$taskStream->post($luid, array(
				'type' => 'Streams/task/progress',
				'instructions' => @compact('processed', 'progress'),
			), true);
		}

		$exceptions = json_decode($taskStream->errors, true);
		if (count($exceptions)) {
			$taskStream->setAttribute("processed", 0);
			$taskStream->setAttribute("progress", 0);
			$taskStream->save();

			$errors = array();
			foreach($exceptions as $i => $exception) {
				$errors[Q::interpolate($texts['errorLine'], array($i))] = $exception;
			}

			$taskStream->post($luid, array(
				'type' => 'Streams/task/error',
				'instructions' => $errors,
			), true);

			return;
		}

		// if we reached here, then the task has completed
		$taskStream->setAttribute('complete', 1);
		$taskStream->save();
		$taskStream->post($luid, array(
			'type' => 'Streams/task/complete'
		), true);
	}
	/**
	 * Make communities import from CSV file.
	 * @method communities
	 * @static
	 * @param {Streams_Stream} $taskStream Required. Stream with filled instruction field.
	 * @throws
	 * @return void
	 */
	static function communities($taskStream)
	{
		// increase memory limit
		ini_set('memory_limit', '500M');

		$texts = Q_Text::get('Communities/content')['import'];

		if (!($taskStream instanceof Streams_Stream)) {
			throw new Exception($texts['taskStreamInvalid']);
		}

		$instructions = $taskStream->instructions;

		// init errors
		$taskStream->errors = json_encode(array());
		$taskStream->save();

		$activateUsers = (bool)$taskStream->getAttribute('activateUsers');

		if (empty($instructions)) {
			throw new Exception($texts['instructionsEmpty']);
		}
		$instructions = json_decode($instructions);

		$luid = Users::loggedInUser(true)->id;

		// Send the response and keep going.
		// WARN: this potentially ties up the PHP thread for a long time
		$timeLimit = Q_Config::get('Streams', 'import', 'timeLimit', 100000);
		ignore_user_abort(true);
		set_time_limit($timeLimit);
		session_write_close();

		// count the number of rows
		$lineCount = count($instructions);
		$taskStream->setAttribute('items', $lineCount);

		$requiredFields = array(
			'name',
			'icon',
			'url'
		);

		$fields = array();

		// start parsing the rows
		foreach ($instructions as $j => $line) {
			if (!$line) {
				continue;
			}
			if (++$j === 1) {
				// get the fields from the first row
				$fields = array_map(function ($val) {
					return Q_Utils::normalize(trim($val));
				}, $line);

				// check for required fields
				foreach($requiredFields as $key => $item) {
					if (is_array($item)) {
						$requiredFieldExist = false;
						foreach ($item as $item2) {
							if (is_array($item2) && count(array_intersect($item2, $fields)) == count($item2)) {
								$requiredFieldExist = true;
							} elseif (in_array($item2, $fields)) {
								$requiredFieldExist = true;
							}
						}

						if (!$requiredFieldExist) {
							throw new Exception(Q::interpolate($texts['fieldNotFound'], array($key)));
						}
					} elseif (!in_array($item, $fields)) {
						throw new Exception(Q::interpolate($texts['fieldNotFound'], array($item)));
					}
				}

				continue;
			}

			$processed = $taskStream->getAttribute('processed', 0);
			if ($j <= $processed) {
				continue;
			}
			$empty = true;
			foreach ($line as $v) {
				if ($v) {
					$empty = false;
					break;
				}
			}
			if ($empty) {
				continue;
			}

			$data = array();

			try {
				foreach ($line as $i => $value) {
					$field = $fields[$i];

					$value = trim(preg_replace("/[\n\r|\n|\r]/", " ", $value));

					$data[$field] = $value;
				}

				$communityId = Communities::idFromName($data['name']);
				// check if community already exist
				$addedUsers = Users_User::select()
					->where(array('id' => $communityId))
					->ignoreCache()
					->fetchDbRows();

				if ($addedUsers) {
					//continue;
					$user = Users::fetch($communityId, true);
				} else {
					$user = Communities::create($data['name']);
				}

				// temporary assign admin permissions to logged user
				// it need to save custom icon
				self::grantUserAccess($user);

				// url
				if (!empty($data['url'])) {
					self::updateURL($user, $data['url']);
				}

				// import icon
				if (self::isPhotoUrl($data['icon'])) {
					$icon = Q_Image::iconArrayWithUrl($data['icon'], 'Users/icon');
					Users::importIcon($user, $icon);
					$user->save();
				}

				// create location
				if (!empty($data['location'])) {
					self::updateLocation($user, $data['location']);
				}

				// create primary person
				if (!empty($data['contact']) && !empty($data['email'])) {
					self::updateContact($user, $data['contact'], $data['email'], $activateUsers);
				}

				// remove temp access row
				self::denyUserAccess($user);
			} catch (Exception $e) {
				// save error to stream
				$exceptions = json_decode($taskStream->errors, true);
				$exceptions[$j] = $e->getMessage();
				$taskStream->errors = json_encode($exceptions);
				$taskStream->save();
			}

			$processed = $j;
			$taskStream->setAttribute('processed', $processed);
			$progress = ($j/$lineCount) * 100;
			$taskStream->setAttribute('progress', $progress);
			$taskStream->save();
			$taskStream->post($luid, array(
				'type' => 'Streams/task/progress',
				'instructions' => @compact('processed', 'progress'),
			), true);
		}

		$exceptions = json_decode($taskStream->errors, true);
		if (count($exceptions)) {
			$taskStream->setAttribute("processed", 0);
			$taskStream->setAttribute("progress", 0);
			$taskStream->save();

			$errors = array();
			foreach($exceptions as $i => $exception) {
				$errors[Q::interpolate($texts['errorLine'], array($i))] = $exception;
			}

			$taskStream->post($luid, array(
				'type' => 'Streams/task/error',
				'instructions' => $errors,
			), true);

			return;
		}

		// if we reached here, then the task has completed
		$taskStream->setAttribute('complete', 1);
		$taskStream->save();
		$taskStream->post($luid, array(
			'type' => 'Streams/task/complete'
		), true);
	}
}