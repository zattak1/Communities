<div class="Communities_events_column" data-emptyEvents="<?php echo empty($relations) ?>">
	<?php if ($columnsStyle == 'classic'): ?>
        <div id="Communities_new_event" class="Communities_top_controls">
            <input name="query" value="" type="text" id="Communities_eventChooser_input" class="Communities_eventChooser_input" placeholder="<?php echo $text['events']['filterEvents'] ?>">
            <?php if ($newEventAuthorized): ?>
                <button id="Communities_new_event_button" class="Q_button Q_aspect_when"><?=$events['NewEvent']?></button>
            <?php endif ?>
        </div>
	<?php endif; ?>

    <div class="Communities_no_items">
        <?php echo $events['NoneYet'] ?>
    </div>
    <div class="Communities_events Communities_column_flex">
        <?php
        // The config key wins where it is set; the publisher-type heuristic is a
        // per-event fallback, so it must not be written back into the shared
        // variable — that would apply the first event's answer to the whole page.
        $configuredHideIfNoParticipants = $hideIfNoParticipants;
        foreach ($relations as $relation) {
            $hideIfNoParticipants = is_null($configuredHideIfNoParticipants)
                ? !Users::isCommunityId($relation->fromPublisherId)
                : $configuredHideIfNoParticipants;
            echo Q::tool(array(
                "Streams/preview" => array(
                    'publisherId' => $relation->fromPublisherId,
                    'streamName' => $relation->fromStreamName,
                    'closeable' => false
                ),
                "Calendars/event/preview" => array(
                    'hideIfNoParticipants' => $hideIfNoParticipants,
                    'textfill' => $textfill
                )
            ), array(
				'id' => Q_Utils::normalize(
					$relation->fromPublisherId . ' ' . $relation->fromStreamName
				),
				'lazyload' => false
			));
        } ?>
    </div>
</div>