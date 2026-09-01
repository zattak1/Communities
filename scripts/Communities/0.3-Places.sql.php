<?php

function Communities_0_3_Places()
{
	$app = Q::app();
	$timeLimit = Q_Config::get('Places', 'installer', 'timeLimit', 36000);
	set_time_limit($timeLimit);
	$communityId = Users::communityId();
	
	Users::setLoggedInUser($communityId);

	// set required actions for community create process
	// (create streams Streams/user/username, Streams/experience/main, etc)
	Communities::prepareCommunity($communityId);

	echo "Set the community as the logged-in user.\n";
	Users_Label::addLabel('Communities/occupants', $communityId, 'Occupants', 'labels/default', false);
	$count = 0;

	Streams::$dontCache = true;

	$locations = Q_Config::get('Places', 'locations', array());
	foreach ($locations as $placeId => $l) {
		$location = Places_Location::stream($communityId, $communityId, $placeId, array(
			'throwIfBadValue' => true
		));
		echo "Added location $placeId\n";
		$ltitle = Q::ifset($l, 'title', $location->title);
		if (is_string($l['floors'])) {
			// iterate through the floors and areas of that location,
			// but with this location's stream and title
			$l = $locations[$l['floors']];
		}
		$floors = Q::ifset($l, 'floors', array());
		foreach ($floors as $fkey => $f) {
			$parts = explode('...', $fkey);
			$ffrom = reset($parts);
			$fto = end($parts);
			$fcount = 0;
			for ($fi = $ffrom; $fi <= $fto; ++$fi) {
				if (++$fcount > 1000) {
					throw new Q_Exception_BadValue(array(
						'internal' => "Communities/locations/$placeId/floors/$fkey",
						'problem' => "Too many floors in that range"
					));
				}
				$columns = Q::ifset($f, 'columns', array());
				foreach ($columns as $ckey => $c) {
					$parts = explode('...', $ckey);
					$cfrom = reset($parts);
					$cto = end($parts);
					$ccount = 0;
					for ($ci = $cfrom; $ci <= $cto; ++$ci) {
						if (++$ccount > 1000) {
							throw new Q_Exception_BadValue(array(
								'internal' => "Communities/locations/$placeId/floors/$fkey/columns/$ckey",
								'problem' => "Too many columns in that range"
							));
						}
						$title = Q::ifset($c, 'title', "{{location}} apartment {{floor}}{{column}}");
						$ai = Q::interpolate($title, array(
							'location' => $ltitle,
							'floor' => $fi,
							'column' => $ci
						));
						list($area, $floor, $column) = Places_Location::addArea(
							$location, $ai, $fi, $ci, array(
								'skipAccess' => true,
								'dontCache' => true
							)
						);
						++$count;
						echo "$count areas added, memory used: ",
							ceil(memory_get_usage() / 1048576) . "MB\n";
						echo "Added area $ai, floor $fi, column $ci\n";
						$participants = Streams_Participant::select()
						->where(array(
							'publisherId' => $area->publisherId,
							'streamName' => $area->name
						))->fetchDbRows();
						if ($participants) {
							echo "Already added user " . reset($participants)->userId ."\n";
							continue; // already invited a user
						}
						$template = "$communityId/invitations/invited.handlebars";
						if (!Q::realPath('views'.DS.$template)) {
							$template = "$app/invitations/invited.handlebars";
						}
						$result = $area->invite(array('newFutureUsers' => 1), array(
							'html' => array($template, 'areas'),
							'asUserId' => $communityId,
							'addLabel' => array(
								'Communities/occupants' => array(
									'Occupants', 'labels/Communities/members'
								),
								'Communities/members' => array(
									'Members', 'labels/Communities/members'
								)
							),
							'appUrl' => Q_Uri::url("Communities/home"),
							'writeLevel' => Streams::$WRITE_LEVEL['post'],
							'skipAccess' => true
						));
						$userId = reset($result['userIds']);
						echo "Invited user with id $userId.\n";
						$params = @compact('userId');
					}
				}
			}
		}
	}

	Streams::$dontCache = false;
}

Communities_0_3_Places();