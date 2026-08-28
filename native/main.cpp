#include <QFile>
#include <QGuiApplication>
#include <QJsonDocument>
#include <QJsonObject>
#include <QLocale>
#include <QQmlApplicationEngine>
#include <QTimer>
#include <QTranslator>

#include <cstdio>

namespace {
QString supportedLanguage()
{
    const QString language = QLocale::system().name().section(QLatin1Char('_'), 0, 0);
    return language == QStringLiteral("es") || language == QStringLiteral("ca")
        ? language
        : QStringLiteral("en");
}
}

int main(int argc, char *argv[])
{
    QGuiApplication app(argc, argv);
    QCoreApplication::setOrganizationName(QStringLiteral("0xCyberBerserker"));
    QCoreApplication::setApplicationName(QStringLiteral("OSCP Knowledge Paths"));
    QCoreApplication::setApplicationVersion(QStringLiteral("0.2.0"));

    QFile packFile(QStringLiteral(":/knowledge/packs/oscp-interactive.json"));
    if (!packFile.open(QIODevice::ReadOnly)) {
        qCritical("Unable to open the embedded knowledge pack");
        return EXIT_FAILURE;
    }

    QJsonParseError parseError;
    const QJsonDocument packDocument = QJsonDocument::fromJson(packFile.readAll(), &parseError);
    if (parseError.error != QJsonParseError::NoError || !packDocument.isObject()) {
        qCritical("Invalid embedded knowledge pack: %s", qPrintable(parseError.errorString()));
        return EXIT_FAILURE;
    }

    const QJsonObject pack = packDocument.object();
    if (pack.value(QStringLiteral("schemaVersion")).toInt() != 1
        || !pack.value(QStringLiteral("cards")).isArray()
        || !pack.value(QStringLiteral("paths")).isArray()) {
        qCritical("Unsupported embedded knowledge pack");
        return EXIT_FAILURE;
    }

    const QString language = supportedLanguage();
    QTranslator translator;
    if (language != QStringLiteral("en")) {
        const QString translation = QStringLiteral(":/i18n/oscp_knowledge_%1.qm").arg(language);
        if (translator.load(translation))
            app.installTranslator(&translator);
    }

    QQmlApplicationEngine engine;
    QObject::connect(&engine, &QQmlEngine::warnings, [](const QList<QQmlError> &warnings) {
        for (const QQmlError &warning : warnings)
            std::fprintf(stderr, "%s\n", qPrintable(warning.toString()));
    });
    engine.setInitialProperties({
        {QStringLiteral("knowledgePack"), pack.toVariantMap()},
        {QStringLiteral("systemLanguage"), language},
    });
    engine.loadFromModule(QStringLiteral("OSCP.Knowledge"), QStringLiteral("Main"));

    if (engine.rootObjects().isEmpty()) {
        std::fprintf(stderr, "Unable to create the QML root object\n");
        return EXIT_FAILURE;
    }

    if (app.arguments().contains(QStringLiteral("--smoke-test")))
        QTimer::singleShot(250, &app, &QCoreApplication::quit);

    return app.exec();
}
