<?php
function Communities_0_9_7_3_Streams()
{
	$streamTemplate = new Streams_Stream();
	$streamTemplate->publisherId = "";
	$streamTemplate->name = "Streams/interest/";
	if ($streamTemplate->retrieve()) {
		$streamTemplate->adminLevel = Streams::$ADMIN_LEVEL['own'];
		$streamTemplate->save();
	}
}

Communities_0_9_7_3_Streams();