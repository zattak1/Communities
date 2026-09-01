<?php

function Communities_0_9_Streams()
{
	$communityId = Users::communityId();
	
	$access = new Streams_Access();
	$access->publisherId = '';
	$access->streamName = 'Websites/article/';
	$access->ofContactLabel = 'Communities/occupants';
	$access->readLevel = Streams::$WRITE_LEVEL['max'];
	$access->writeLevel = -1;
	$access->adminLevel = -1;
	$access->save(true);
}

Communities_0_9_Streams();