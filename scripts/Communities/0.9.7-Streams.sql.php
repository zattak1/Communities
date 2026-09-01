<?php
function Communities_0_9_7_Streams()
{
	$streamNames = array(
		'Streams/experience/main',
		'Streams/labels',
		'Streams/contacts',
		'Streams/user/username',
		'Places/user/locations',
		'Places/location*',
		'Places/area*',
		'Places/floor*',
		'Places/column*'
	);

	// add default mutable access rows to streams for some communities labels
	// Members of the community can see
	// all the community's contacts and labels, locations, main experience, etc.
	foreach (Users_Label::ofCommunities() as $label) {
		foreach ($streamNames as $streamName) {
			// give admins full access to Streams/experience/main stream
			$access = new Streams_Access();
			$access->publisherId = '';
			$access->streamName = $streamName;
			$access->ofContactLabel = $label;
			if ($label == 'Users/owners') {
				$access->readLevel = Streams::$READ_LEVEL['max'];
				$access->writeLevel = Streams::$WRITE_LEVEL['max'];
				$access->adminLevel = Streams::$ADMIN_LEVEL['max'];
			} else if ($label == 'Users/admins') {
				$access->readLevel = Streams::$READ_LEVEL['max'];
				$access->writeLevel = Streams::$WRITE_LEVEL['edit'];
				$access->adminLevel = Streams::$ADMIN_LEVEL['manage'];
			} else if ($label == 'Users/members') {
				$access->readLevel = Streams::$READ_LEVEL['max'];
				$access->writeLevel = Streams::$WRITE_LEVEL['edit'];
				$access->adminLevel = Streams::$ADMIN_LEVEL['none'];
			} else if ($label == 'Users/guests') {
				$access->readLevel = Streams::$READ_LEVEL['content'];
				$access->writeLevel = Streams::$WRITE_LEVEL['vote'];
				$access->adminLevel = Streams::$ADMIN_LEVEL['none'];
			} else {
				continue;
			}
			$access->save(true);
		}
	}

	$app = Q::app();
	// allow everybody create Places/area streams on behalf of main community
	// and relate these streams to Places/location of main community
	foreach (array('Places/area', 'Places/location') as $type) {
		$defaults =  Streams_Stream::getConfigField($type, 'defaults');
		$s = new Streams_Stream(array(
			'publisherId' => $app,
			'name' => $type.'/',
			'icon' => $defaults['icon'],
			'title' => $defaults['title'],
			'type' => 'Streams/template'
		));

		if ($type == 'Places/area') {
			$s->readLevel = Streams::$READ_LEVEL['max'];
			$s->writeLevel = Streams::$WRITE_LEVEL['max'];
			$s->adminLevel = Streams::$ADMIN_LEVEL['own'];
		} elseif($type == 'Places/location') {
			$s->writeLevel = Streams::$WRITE_LEVEL['relate'];
		}

		$s->save(true);
	}

	$communities = Communities::getAllCommunities();
	// add labels (from Users/roles) for all communities
	foreach($communities as $communityId => $community) {
		Communities::addCommunityLabels($communityId);
	}
}

Communities_0_9_7_Streams();