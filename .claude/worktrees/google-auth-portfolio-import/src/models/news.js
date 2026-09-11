module.exports = (sequelize, DataTypes) => {
  const News = sequelize.define('News', {
    uuid: { type: DataTypes.STRING, unique: true, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    publisher: DataTypes.STRING,
    link: DataTypes.STRING,
    publishedAt: DataTypes.DATE,
    type: { type: DataTypes.STRING, defaultValue: 'company' },
    thumbnail: DataTypes.STRING,
    // ARRAY is PostgreSQL-only; fall back to JSON for local SQLite/other dialects.
    relatedTickers: sequelize.getDialect() === 'postgres'
      ? { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] }
      : { type: DataTypes.JSON, defaultValue: [] },
  }, { timestamps: true });

  News.associate = (models) => {
    News.belongsTo(models.Stock, { foreignKey: 'stockId', as: 'stock' });
  };

  return News;
};
