<?php

function Communities_0_8_Streams()
{	
	$communityId = Users::communityId();
	
	// access stream for managing community roles
	$stream = new Streams_Stream();
	$stream->publisherId = $communityId;
	$stream->name = 'Streams/contacts';
	if ($stream->retrieve()) {
		$prefixes = $stream->getAttribute('prefixes', array());
		$prefixes[] = 'Communities/';
		$stream->setAttribute('prefixes', $prefixes);
		$stream->save();
	}
	
	// access stream for managing community roles
	$stream = new Streams_Stream();
	$stream->publisherId = $communityId;
	$stream->name = 'Streams/labels';
	if ($stream->retrieve()) {
		$prefixes = $stream->getAttribute('prefixes', array());
		$prefixes[] = 'Communities/';
		$stream->setAttribute('prefixes', $prefixes);
		$stream->save();
	}
}

Communities_0_8_Streams();