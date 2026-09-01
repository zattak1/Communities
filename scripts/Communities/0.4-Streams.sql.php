<?php

function Communities_0_4_Streams()
{
	$communityId = Users::communityId();
	$communityName = Users::communityName();
	
	// Category of streams accessible only to admins
	$streamName = "Streams/category/admins";
	if (!Streams_Stream::select()->where(array(
		"publisherId" => $communityId,
		"name" => $streamName
	))->fetchDbRow()) {
		Streams::create($communityId, $communityId, 'Streams/category', array(
			'name' => $streamName,
			'title' => "For $communityName Admins",
			'readLevel' => 0,
			'writeLevel' => 0,
			'adminLevel' => 0
		), array(
			'skipAccess' => true
		));
	}

	foreach (array('Streams/file/', 'Websites/article/', 'Streams/category/') as $fromStreamName) {
		$params = array(
			'toPublisherId' => '',
			'toStreamName' => 'Streams/category/',
			'type' => 'Streams/shared',
			'fromPublisherId' => '',
			'fromStreamName' => $fromStreamName
		);
		if (Streams_RelatedTo::select()->where($params)->fetchDbRow()) {
			continue;
		}

		Streams_RelatedTo::insert($params)->execute();
	}

	$streamName = "Streams/category/occupants";
	if (!Streams_Stream::select()->where(array(
		"publisherId" => $communityId,
		"name" => $streamName
	))->fetchDbRow()) {
		// Category of streams for occupants to access
		Streams::create($communityId, $communityId, 'Streams/category', array(
			'name' => $streamName,
			'title' => "For $communityName occupants",
			'readLevel' => Streams::$READ_LEVEL['none'],
			'writeLevel' => Streams::$WRITE_LEVEL['none'],
			'adminLevel' => Streams::$ADMIN_LEVEL['none']
		), array(
			'skipAccess' => true
		));
	}

	$access = new Streams_Access();
	$access->publisherId = $communityId;
	$access->streamName = 'Streams/category/occupants';
	$access->ofContactLabel = 'Communities/occupants';
	$access->readLevel = Streams::$WRITE_LEVEL['max'];
	$access->writeLevel = -1;
	$access->adminLevel = -1;
	if (!$access->retrieve()) {
		$access->save(true);
	}
}

Communities_0_4_Streams();