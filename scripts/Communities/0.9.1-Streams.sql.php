<?php
	
function Communities_9_1_Streams()
{
	// Allow any users to start conversations in an interest
	$communityId = Users::communityId();
	$stream = new Streams_Stream(array(
		'publisherId' => '',
		'name' => 'Streams/chat/',
		'type' => 'Streams/template',
		'title' => 'Conversation',
		'icon' => 'Streams/chat'
	));
	$stream->save(true);
	
	$stream = new Streams_Stream(array(
		'publisherId' => '',
		'name' => 'Streams/interest/',
		'type' => 'Streams/template',
		'icon' => 'Streams/interest/default',
		'writeLevel' => Streams::$WRITE_LEVEL['relate']
	));
	$stream->save(true);
	
	$relatedTo = new Streams_RelatedTo(array(
		'toPublisherId' => '',
		'toStreamName' => 'Streams/interest/',
		'type' => 'Communities/conversations',
		'fromPublisherId' => '',
		'fromStreamName' => 'Streams/chat/'
	));
	$relatedTo->save(true);
}

Communities_9_1_Streams();