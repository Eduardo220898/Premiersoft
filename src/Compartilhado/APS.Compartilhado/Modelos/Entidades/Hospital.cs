using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace APS.Compartilhado.Modelos.Entidades;

/// <summary>
/// Entidade que representa um hospital
/// </summary>
public class Hospital
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    [StringLength(200)]
    public string Nome { get; set; } = string.Empty;
    
    [Required]
    [StringLength(20)]
    public string CNES { get; set; } = string.Empty; // Código Nacional de Estabelecimentos de Saúde
    
    [StringLength(20)]
    public string? CNPJ { get; set; }
    
    [Required]
    [StringLength(300)]
    public string Endereco { get; set; } = string.Empty;
    
    [StringLength(10)]
    public string? CEP { get; set; }
    
    [StringLength(20)]
    public string? Telefone { get; set; }
    
    [StringLength(100)]
    public string? Email { get; set; }
    
    [Column(TypeName = "decimal(10,7)")]
    public decimal? Latitude { get; set; }
    
    [Column(TypeName = "decimal(10,7)")]
    public decimal? Longitude { get; set; }
    
    [Required]
    [StringLength(50)]
    public string TipoEstabelecimento { get; set; } = string.Empty; // Hospital Geral, Especializado, etc.
    
    [Required]
    [StringLength(50)]
    public string Natureza { get; set; } = string.Empty; // Público, Privado, Filantrópico
    
    public int CapacidadeLeitos { get; set; }
    
    public int LeitosDisponiveis { get; set; }
    
    public bool Ativo { get; set; } = true;
    
    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;
    
    public DateTime? DataAtualizacao { get; set; }
    
    // Chave estrangeira
    [Required]
    public int MunicipioId { get; set; }
    
    // Relacionamentos
    [ForeignKey("MunicipioId")]
    public virtual Municipio Municipio { get; set; } = null!;
    
    public virtual ICollection<MedicoHospital> MedicosHospitais { get; set; } = new List<MedicoHospital>();
    public virtual ICollection<EspecialidadeHospital> EspecialidadesHospitais { get; set; } = new List<EspecialidadeHospital>();
    public virtual ICollection<Paciente> Pacientes { get; set; } = new List<Paciente>();
}
