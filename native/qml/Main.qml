import QtCore
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    id: root

    required property var knowledgePack
    required property string systemLanguage

    property int selectedPathIndex: 0
    property int selectedStepIndex: 0
    property var completedCards: ({})
    property var privateNotes: ({})
    property string contentLanguage: "en"

    readonly property var activePath: knowledgePack.paths.length > selectedPathIndex
        ? knowledgePack.paths[selectedPathIndex] : ({ "steps": [] })
    readonly property var activeStep: activePath.steps.length > selectedStepIndex
        ? activePath.steps[selectedStepIndex] : ({ "cardId": "" })
    readonly property var activeCard: cardById(activeStep.cardId)
    readonly property int completedCount: countCompletedSteps()

    width: 1080
    height: 720
    minimumWidth: 760
    minimumHeight: 520
    visible: true
    title: qsTr("OSCP Knowledge Paths")

    Settings {
        id: preferences
        category: "knowledge"
        property string savedLanguage: ""
        property string completedJson: "{}"
        property string notesJson: "{}"
    }

    function parseObject(value) {
        try {
            const parsed = JSON.parse(value)
            return parsed && typeof parsed === "object" ? parsed : {}
        } catch (error) {
            return {}
        }
    }

    function localized(value) {
        if (!value)
            return ""
        return value[contentLanguage]
            || value[knowledgePack.defaultLanguage]
            || value.en
            || ""
    }

    function cardById(cardId) {
        for (let index = 0; index < knowledgePack.cards.length; ++index) {
            if (knowledgePack.cards[index].id === cardId)
                return knowledgePack.cards[index]
        }
        return ({ "id": "", "title": {}, "summary": {}, "body": {}, "tags": [] })
    }

    function stepMatches(card) {
        const query = searchField.text.trim().toLowerCase()
        if (!query)
            return true
        const haystack = (localized(card.title) + " " + localized(card.summary)
            + " " + card.tags.join(" ")).toLowerCase()
        return haystack.indexOf(query) !== -1
    }

    function isCompleted(cardId) {
        return completedCards[cardId] === true
    }

    function countCompletedSteps() {
        let count = 0
        for (let index = 0; index < activePath.steps.length; ++index) {
            if (isCompleted(activePath.steps[index].cardId))
                ++count
        }
        return count
    }

    function toggleCompleted() {
        const updated = parseObject(JSON.stringify(completedCards))
        updated[activeCard.id] = !isCompleted(activeCard.id)
        completedCards = updated
        preferences.completedJson = JSON.stringify(updated)
    }

    function noteFor(cardId) {
        return privateNotes[cardId] || ""
    }

    function saveNote() {
        const updated = parseObject(JSON.stringify(privateNotes))
        const text = noteEditor.text.trim()
        if (text)
            updated[activeCard.id] = text
        else
            delete updated[activeCard.id]
        privateNotes = updated
        preferences.notesJson = JSON.stringify(updated)
        noteSavedLabel.visible = true
        savedIndicator.restart()
    }

    function selectStep(index) {
        selectedStepIndex = index
        noteEditor.text = noteFor(activePath.steps[index].cardId)
    }

    function selectPath(index) {
        selectedPathIndex = index
        selectedStepIndex = 0
        searchField.text = ""
        const path = knowledgePack.paths[index]
        noteEditor.text = path.steps.length ? noteFor(path.steps[0].cardId) : ""
    }

    Component.onCompleted: {
        completedCards = parseObject(preferences.completedJson)
        privateNotes = parseObject(preferences.notesJson)
        const preferred = preferences.savedLanguage || systemLanguage
        contentLanguage = knowledgePack.languages.indexOf(preferred) >= 0
            ? preferred : knowledgePack.defaultLanguage
        languageBox.currentIndex = Math.max(0, knowledgePack.languages.indexOf(contentLanguage))
        noteEditor.text = noteFor(activeCard.id)
    }

    header: ToolBar {
        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 16
            anchors.rightMargin: 16

            ColumnLayout {
                spacing: 0
                Label {
                    text: qsTr("OSCP Knowledge Paths")
                    font.pixelSize: 20
                    font.bold: true
                }
                Label {
                    text: qsTr("Offline methodology and reference cards")
                    color: palette.placeholderText
                }
            }

            Item { Layout.fillWidth: true }

            Label { text: qsTr("Content language") }
            ComboBox {
                id: languageBox
                model: knowledgePack.languages
                Accessible.name: qsTr("Content language")
                onActivated: {
                    root.contentLanguage = currentText
                    preferences.savedLanguage = currentText
                }
            }
        }
    }

    SplitView {
        anchors.fill: parent
        orientation: Qt.Horizontal

        Pane {
            SplitView.preferredWidth: 320
            SplitView.minimumWidth: 250

            ColumnLayout {
                anchors.fill: parent
                spacing: 12

                Label {
                    Layout.fillWidth: true
                    text: root.localized(root.activePath.title)
                    font.pixelSize: 18
                    font.bold: true
                    wrapMode: Text.WordWrap
                }
                Label {
                    Layout.fillWidth: true
                    text: root.localized(root.activePath.description)
                    color: palette.placeholderText
                    wrapMode: Text.WordWrap
                }
                Label { text: qsTr("Path") }
                ComboBox {
                    id: pathBox
                    Layout.fillWidth: true
                    model: knowledgePack.paths
                    displayText: root.localized(root.activePath.title)
                    Accessible.name: qsTr("Path")
                    delegate: ItemDelegate {
                        required property int index
                        required property var modelData
                        width: pathBox.width
                        text: root.localized(modelData.title)
                        highlighted: pathBox.highlightedIndex === index
                    }
                    onActivated: root.selectPath(currentIndex)
                }
                ProgressBar {
                    Layout.fillWidth: true
                    from: 0
                    to: Math.max(1, root.activePath.steps.length)
                    value: root.completedCount
                    Accessible.name: qsTr("Path progress")
                }
                Label {
                    text: qsTr("%1 of %2 completed").arg(root.completedCount).arg(root.activePath.steps.length)
                    color: palette.placeholderText
                }
                TextField {
                    id: searchField
                    Layout.fillWidth: true
                    placeholderText: qsTr("Filter steps")
                    Accessible.name: qsTr("Filter steps")
                }
                ListView {
                    id: stepList
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    clip: true
                    spacing: 4
                    model: root.activePath.steps

                    delegate: ItemDelegate {
                        id: stepDelegate
                        required property int index
                        required property var modelData
                        readonly property var card: root.cardById(modelData.cardId)
                        readonly property bool matchesFilter: root.stepMatches(card)

                        width: ListView.view.width
                        height: matchesFilter ? implicitHeight : 0
                        visible: matchesFilter
                        highlighted: index === root.selectedStepIndex
                        text: root.localized(card.title)
                        icon.name: root.isCompleted(card.id)
                            ? "emblem-ok-symbolic" : "go-next-symbolic"
                        Accessible.description: root.localized(card.summary)
                        onClicked: root.selectStep(index)
                    }
                }
            }
        }

        Pane {
            SplitView.fillWidth: true

            ColumnLayout {
                anchors.fill: parent
                spacing: 12

                RowLayout {
                    Layout.fillWidth: true
                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 2
                        Label {
                            Layout.fillWidth: true
                            text: root.localized(root.activeCard.title)
                            font.pixelSize: 26
                            font.bold: true
                            wrapMode: Text.WordWrap
                        }
                        Label {
                            Layout.fillWidth: true
                            text: root.localized(root.activeCard.summary)
                            color: palette.placeholderText
                            wrapMode: Text.WordWrap
                        }
                    }
                    Button {
                        text: root.isCompleted(root.activeCard.id)
                            ? qsTr("Completed") : qsTr("Mark complete")
                        icon.name: root.isCompleted(root.activeCard.id)
                            ? "emblem-ok-symbolic" : "checkbox-symbolic"
                        onClicked: root.toggleCompleted()
                    }
                }

                Frame {
                    Layout.fillWidth: true
                    Layout.fillHeight: true

                    ScrollView {
                        anchors.fill: parent
                        contentWidth: availableWidth

                        ColumnLayout {
                            width: parent.width
                            spacing: 18

                            TextArea {
                                Layout.fillWidth: true
                                text: root.localized(root.activeCard.body)
                                textFormat: Text.MarkdownText
                                wrapMode: TextEdit.Wrap
                                font.pixelSize: 16
                                readOnly: true
                                selectByMouse: true
                            }

                            GroupBox {
                                Layout.fillWidth: true
                                title: qsTr("Local note")

                                ColumnLayout {
                                    anchors.fill: parent
                                    Label {
                                        Layout.fillWidth: true
                                        text: qsTr("Stored in this user profile; do not enter secrets.")
                                        color: palette.placeholderText
                                        wrapMode: Text.WordWrap
                                    }
                                    TextArea {
                                        id: noteEditor
                                        Layout.fillWidth: true
                                        Layout.preferredHeight: 130
                                        placeholderText: qsTr("Write a local note for this card")
                                        wrapMode: TextEdit.Wrap
                                        Accessible.name: qsTr("Local note")
                                    }
                                    RowLayout {
                                        Button {
                                            text: qsTr("Save note")
                                            icon.name: "document-save-symbolic"
                                            onClicked: root.saveNote()
                                        }
                                        Label {
                                            id: noteSavedLabel
                                            visible: false
                                            text: qsTr("Saved")
                                            color: palette.highlight
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                RowLayout {
                    Layout.fillWidth: true
                    Button {
                        text: qsTr("Previous")
                        icon.name: "go-previous-symbolic"
                        enabled: root.selectedStepIndex > 0
                        onClicked: root.selectStep(root.selectedStepIndex - 1)
                    }
                    Item { Layout.fillWidth: true }
                    Button {
                        text: qsTr("Next")
                        icon.name: "go-next-symbolic"
                        enabled: root.selectedStepIndex + 1 < root.activePath.steps.length
                        onClicked: root.selectStep(root.selectedStepIndex + 1)
                    }
                }
            }
        }
    }

    Timer {
        id: savedIndicator
        interval: 1800
        onTriggered: noteSavedLabel.visible = false
    }
}
